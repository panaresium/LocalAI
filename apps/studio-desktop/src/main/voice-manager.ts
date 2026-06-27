import type {
  ConfigureVoiceRequest,
  SetVoiceMicrophonePermissionRequest,
  SpeakVoiceRequest,
  StartVoiceCaptureRequest,
  StopVoiceCaptureRequest,
  SubmitVoiceUtteranceRequest,
  VoiceCaptureMode,
  VoiceLanguage,
  VoiceMicrophoneState,
  VoicePolicy,
  VoiceSelfTestItem,
  VoiceSelfTestResult,
  VoiceSession,
  VoiceState,
  VoiceTranscript,
  VoiceTtsUtterance
} from "@hermes-local-ai/contracts";

const MILESTONE10_VOICE_POLICY: VoicePolicy = {
  milestone: 10,
  microphoneRequiresExplicitGrant: true,
  defaultCaptureMode: "push-to-talk",
  wakeWordRequiresOptIn: true,
  bargeInEnabled: true,
  localOnly: true,
  externalAsrEnabled: false,
  externalTtsEnabled: false,
  supportedLanguages: ["en", "th"],
  vad: {
    thresholdRms: 0.08,
    minSpeechMs: 250,
    hangoverMs: 180
  },
  wakeWords: ["hermes", "เฮอร์มีส"],
  blockedCommandTerms: [
    "password",
    "passcode",
    "otp",
    "mfa",
    "payment",
    "credit card",
    "wire transfer",
    "รหัสผ่าน",
    "ชำระเงิน"
  ]
};

const INITIAL_SESSION: VoiceSession = {
  id: "voice-session-idle",
  mode: "push-to-talk",
  status: "idle",
  language: "en",
  startedAt: null,
  stoppedAt: null,
  detail: "Voice capture is idle.",
  bargeInCount: 0
};

export class VoiceManager {
  private microphone: VoiceMicrophoneState = {
    permission: "not-requested",
    deviceLabel: null,
    requestedAt: null,
    updatedAt: null
  };
  private session: VoiceSession = INITIAL_SESSION;
  private readonly transcripts: VoiceTranscript[] = [];
  private readonly ttsQueue: VoiceTtsUtterance[] = [];
  private activeTtsId: string | null = null;
  private wakeWordEnabled = false;
  private wakeWord = "hermes";
  private nextSessionId = 1;
  private nextTranscriptId = 1;
  private nextTtsId = 1;
  private lastSelfTest: VoiceSelfTestResult | null = null;

  public getState(): VoiceState {
    return {
      policy: MILESTONE10_VOICE_POLICY,
      microphone: this.microphone,
      session: this.session,
      transcripts: [...this.transcripts],
      ttsQueue: [...this.ttsQueue],
      activeTtsId: this.activeTtsId,
      wakeWordEnabled: this.wakeWordEnabled,
      wakeWord: this.wakeWord,
      lastSelfTest: this.lastSelfTest
    };
  }

  public setMicrophonePermission(request: SetVoiceMicrophonePermissionRequest): VoiceState {
    const permission = request.permission;
    if (permission !== "granted" && permission !== "denied") {
      throw new Error("Invalid microphone permission.");
    }
    const now = new Date().toISOString();
    this.microphone = {
      permission,
      deviceLabel: normalizeOptionalLabel(request.deviceLabel),
      requestedAt: this.microphone.requestedAt ?? now,
      updatedAt: now
    };
    if (permission === "denied" && this.session.status === "listening") {
      this.session = {
        ...this.session,
        status: "interrupted",
        stoppedAt: now,
        detail: "Microphone permission was denied."
      };
    }
    return this.getState();
  }

  public configure(request: ConfigureVoiceRequest): VoiceState {
    if (typeof request.wakeWordEnabled !== "boolean") {
      throw new Error("Invalid wake-word configuration.");
    }
    this.wakeWordEnabled = request.wakeWordEnabled;
    if (request.wakeWord !== undefined) {
      this.wakeWord = normalizeWakeWord(request.wakeWord);
    }
    return this.getState();
  }

  public startCapture(request: StartVoiceCaptureRequest): VoiceState {
    const mode = normalizeCaptureMode(request.mode);
    const language = normalizeLanguage(request.language);
    if (this.microphone.permission !== "granted") {
      throw new Error("Microphone permission must be granted before voice capture starts.");
    }
    if (mode === "wake-word" && !this.wakeWordEnabled) {
      throw new Error("Wake-word capture requires explicit opt-in.");
    }

    let bargeInCount = this.session.bargeInCount;
    if (this.session.status === "speaking" && this.activeTtsId) {
      this.interruptActiveTts("barge-in");
      bargeInCount += 1;
    }

    const now = new Date().toISOString();
    this.session = {
      id: `voice-session-${this.nextSessionId}`,
      mode,
      status: "listening",
      language,
      startedAt: now,
      stoppedAt: null,
      detail: mode === "wake-word" ? `Listening for ${this.wakeWord}.` : "Push-to-talk capture is active.",
      bargeInCount
    };
    this.nextSessionId += 1;
    return this.getState();
  }

  public stopCapture(request: StopVoiceCaptureRequest = {}): VoiceState {
    const now = new Date().toISOString();
    const reason = normalizeOptionalReason(request.reason) ?? "Voice capture stopped.";
    this.session = {
      ...this.session,
      status: "idle",
      stoppedAt: now,
      detail: reason
    };
    return this.getState();
  }

  public submitUtterance(request: SubmitVoiceUtteranceRequest): VoiceState {
    const text = normalizeUtteranceText(request.text);
    const language = normalizeLanguage(request.language);
    const rms = normalizeRms(request.rms);
    const durationMs = normalizeDuration(request.durationMs);
    const sessionId = normalizeSessionId(request.sessionId, this.session.id);
    const vadAccepted = rms >= MILESTONE10_VOICE_POLICY.vad.thresholdRms &&
      durationMs >= MILESTONE10_VOICE_POLICY.vad.minSpeechMs;
    const normalizedText = normalizeTranscriptText(text, language);
    const wakeWordDetected = detectWakeWord(normalizedText, this.wakeWord, language);
    const blockedTerm = findBlockedCommandTerm(normalizedText);
    const now = new Date().toISOString();

    let status: VoiceTranscript["status"] = "accepted";
    let reason: string | null = null;
    let commandDraft: string | null = stripWakeWord(text, this.wakeWord, language);
    if (!vadAccepted) {
      status = "rejected";
      reason = "Voice activity detection rejected silence or too-short speech.";
      commandDraft = null;
    } else if (blockedTerm) {
      status = "blocked";
      reason = `Blocked sensitive voice command term: ${blockedTerm}.`;
      commandDraft = null;
    } else if (this.session.mode === "wake-word" && this.wakeWordEnabled && !wakeWordDetected) {
      status = "rejected";
      reason = "Wake word was not detected.";
      commandDraft = null;
    }

    const transcript: VoiceTranscript = {
      id: `voice-transcript-${this.nextTranscriptId}`,
      sessionId,
      language,
      text,
      normalizedText,
      commandDraft,
      confidence: status === "accepted" ? scoreTranscriptConfidence(rms, durationMs) : 0,
      vadAccepted,
      wakeWordDetected,
      status,
      reason,
      createdAt: now
    };
    this.nextTranscriptId += 1;
    this.transcripts.unshift(transcript);
    this.transcripts.splice(12);
    this.session = {
      ...this.session,
      status: "processing",
      language,
      detail: status === "accepted" ? "Voice transcript is ready as a command draft." : reason ?? "Voice transcript was rejected."
    };
    return this.getState();
  }

  public speak(request: SpeakVoiceRequest): VoiceState {
    const text = normalizeSpeechText(request.text);
    const language = normalizeLanguage(request.language);
    if (this.activeTtsId) {
      this.interruptActiveTts("new-speech");
    }
    const now = new Date().toISOString();
    const item: VoiceTtsUtterance = {
      id: `voice-tts-${this.nextTtsId}`,
      language,
      text,
      status: "speaking",
      createdAt: now,
      startedAt: now,
      completedAt: null,
      interruptedAt: null,
      interruptReason: null
    };
    this.nextTtsId += 1;
    this.ttsQueue.unshift(item);
    this.ttsQueue.splice(12);
    this.activeTtsId = item.id;
    this.session = {
      ...this.session,
      status: "speaking",
      language,
      detail: "Studio-owned text-to-speech is active."
    };
    return this.getState();
  }

  public interrupt(reason = "manual"): VoiceState {
    if (this.activeTtsId) {
      this.interruptActiveTts(reason);
    }
    this.session = {
      ...this.session,
      status: "interrupted",
      stoppedAt: new Date().toISOString(),
      detail: "Voice output interrupted."
    };
    return this.getState();
  }

  public runSelfTest(): VoiceState {
    const samples = [
      {
        id: "en-push-to-talk",
        language: "en" as const,
        input: "Summarize this project",
        expectedText: "summarize this project"
      },
      {
        id: "th-push-to-talk",
        language: "th" as const,
        input: "สรุปโครงการนี้",
        expectedText: "สรุปโครงการนี้"
      }
    ];
    const items: VoiceSelfTestItem[] = samples.map((sample) => {
      const actualText = normalizeTranscriptText(sample.input, sample.language);
      const passed = actualText === sample.expectedText;
      return {
        id: sample.id,
        language: sample.language,
        input: sample.input,
        expectedText: sample.expectedText,
        actualText,
        status: passed ? "passed" : "failed",
        detail: passed ? "ASR normalization matched." : "ASR normalization mismatch."
      };
    });

    const ttsItem: VoiceSelfTestItem = {
      id: "tts-local-manifest",
      language: "en",
      input: "Voice system ready",
      expectedText: "local-only tts",
      actualText: MILESTONE10_VOICE_POLICY.externalTtsEnabled ? "external tts" : "local-only tts",
      status: MILESTONE10_VOICE_POLICY.externalTtsEnabled ? "failed" : "passed",
      detail: "TTS stays in the local Studio queue without an external provider call."
    };
    items.push(ttsItem);

    this.lastSelfTest = {
      ranAt: new Date().toISOString(),
      status: items.every((item) => item.status === "passed") ? "passed" : "failed",
      items
    };
    return this.getState();
  }

  private interruptActiveTts(reason: string): void {
    const activeId = this.activeTtsId;
    if (!activeId) {
      return;
    }
    const index = this.ttsQueue.findIndex((item) => item.id === activeId);
    if (index >= 0) {
      const existing = this.ttsQueue[index];
      if (existing) {
        this.ttsQueue[index] = {
          ...existing,
          status: "interrupted",
          interruptedAt: new Date().toISOString(),
          interruptReason: reason
        };
      }
    }
    this.activeTtsId = null;
  }
}

function normalizeOptionalLabel(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }
  if (value.length > 120) {
    throw new Error("Microphone label is too long.");
  }
  return value.trim();
}

function normalizeWakeWord(value: string): string {
  const wakeWord = value.trim();
  if (!wakeWord || wakeWord.length > 40) {
    throw new Error("Invalid wake word.");
  }
  return wakeWord;
}

function normalizeCaptureMode(value: unknown): VoiceCaptureMode {
  if (value !== "push-to-talk" && value !== "wake-word") {
    throw new Error("Invalid voice capture mode.");
  }
  return value;
}

function normalizeLanguage(value: unknown): VoiceLanguage {
  if (value !== "en" && value !== "th") {
    throw new Error("Invalid voice language.");
  }
  return value;
}

function normalizeOptionalReason(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > 160) {
    throw new Error("Invalid voice stop reason.");
  }
  return value;
}

function normalizeUtteranceText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid voice utterance.");
  }
  const text = value.trim();
  if (!text || text.length > 500) {
    throw new Error("Invalid voice utterance.");
  }
  return text;
}

function normalizeSpeechText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid voice speech text.");
  }
  const text = value.trim();
  if (!text || text.length > 800) {
    throw new Error("Invalid voice speech text.");
  }
  return text;
}

function normalizeRms(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Invalid voice RMS.");
  }
  return value;
}

function normalizeDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 120000) {
    throw new Error("Invalid voice duration.");
  }
  return value;
}

function normalizeSessionId(value: string | null | undefined, fallback: string): string | null {
  if (value === undefined) {
    return fallback === INITIAL_SESSION.id ? null : fallback;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > 80) {
    throw new Error("Invalid voice session id.");
  }
  return value;
}

function normalizeTranscriptText(text: string, language: VoiceLanguage): string {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  return language === "en" ? collapsed.toLowerCase() : collapsed;
}

function detectWakeWord(normalizedText: string, wakeWord: string, language: VoiceLanguage): boolean {
  const normalizedWakeWord = normalizeTranscriptText(wakeWord, language);
  return normalizedText.includes(normalizedWakeWord) ||
    MILESTONE10_VOICE_POLICY.wakeWords.some((candidate) => normalizedText.includes(normalizeTranscriptText(candidate, language)));
}

function stripWakeWord(text: string, wakeWord: string, language: VoiceLanguage): string {
  let command = text.trim();
  for (const candidate of [wakeWord, ...MILESTONE10_VOICE_POLICY.wakeWords]) {
    const pattern = new RegExp(escapeRegExp(candidate), language === "en" ? "iu" : "u");
    command = command.replace(pattern, "").trim();
  }
  return command || text.trim();
}

function findBlockedCommandTerm(normalizedText: string): string | null {
  return MILESTONE10_VOICE_POLICY.blockedCommandTerms.find((term) => normalizedText.includes(term.toLowerCase())) ?? null;
}

function scoreTranscriptConfidence(rms: number, durationMs: number): number {
  const durationBoost = Math.min(durationMs / 5000, 0.2);
  const score = 0.62 + (rms * 0.55) + durationBoost;
  return Math.min(0.99, Number(score.toFixed(2)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
