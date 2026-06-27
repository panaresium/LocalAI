export type VoiceLanguage = "en" | "th";
export type VoiceCaptureMode = "push-to-talk" | "wake-word";
export type VoiceMicrophonePermission = "not-requested" | "granted" | "denied";
export type VoiceSessionStatus = "idle" | "listening" | "processing" | "speaking" | "interrupted";
export type VoiceTranscriptStatus = "accepted" | "rejected" | "blocked";
export type VoiceTtsStatus = "queued" | "speaking" | "completed" | "interrupted";
export type VoiceSelfTestStatus = "passed" | "failed";

export interface VoiceVadPolicy {
  readonly thresholdRms: number;
  readonly minSpeechMs: number;
  readonly hangoverMs: number;
}

export interface VoicePolicy {
  readonly milestone: 10;
  readonly microphoneRequiresExplicitGrant: true;
  readonly defaultCaptureMode: "push-to-talk";
  readonly wakeWordRequiresOptIn: true;
  readonly bargeInEnabled: true;
  readonly localOnly: true;
  readonly externalAsrEnabled: false;
  readonly externalTtsEnabled: false;
  readonly supportedLanguages: readonly VoiceLanguage[];
  readonly vad: VoiceVadPolicy;
  readonly wakeWords: readonly string[];
  readonly blockedCommandTerms: readonly string[];
}

export const MILESTONE10_VOICE_POLICY: VoicePolicy = {
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

export interface VoiceMicrophoneState {
  readonly permission: VoiceMicrophonePermission;
  readonly deviceLabel: string | null;
  readonly requestedAt: string | null;
  readonly updatedAt: string | null;
}

export interface VoiceSession {
  readonly id: string;
  readonly mode: VoiceCaptureMode;
  readonly status: VoiceSessionStatus;
  readonly language: VoiceLanguage;
  readonly startedAt: string | null;
  readonly stoppedAt: string | null;
  readonly detail: string;
  readonly bargeInCount: number;
}

export interface VoiceTranscript {
  readonly id: string;
  readonly sessionId: string | null;
  readonly language: VoiceLanguage;
  readonly text: string;
  readonly normalizedText: string;
  readonly commandDraft: string | null;
  readonly confidence: number;
  readonly vadAccepted: boolean;
  readonly wakeWordDetected: boolean;
  readonly status: VoiceTranscriptStatus;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface VoiceTtsUtterance {
  readonly id: string;
  readonly language: VoiceLanguage;
  readonly text: string;
  readonly status: VoiceTtsStatus;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly interruptedAt: string | null;
  readonly interruptReason: string | null;
}

export interface VoiceSelfTestItem {
  readonly id: string;
  readonly language: VoiceLanguage;
  readonly input: string;
  readonly expectedText: string;
  readonly actualText: string;
  readonly status: VoiceSelfTestStatus;
  readonly detail: string;
}

export interface VoiceSelfTestResult {
  readonly ranAt: string;
  readonly status: VoiceSelfTestStatus;
  readonly items: readonly VoiceSelfTestItem[];
}

export interface VoiceState {
  readonly policy: VoicePolicy;
  readonly microphone: VoiceMicrophoneState;
  readonly session: VoiceSession;
  readonly transcripts: readonly VoiceTranscript[];
  readonly ttsQueue: readonly VoiceTtsUtterance[];
  readonly activeTtsId: string | null;
  readonly wakeWordEnabled: boolean;
  readonly wakeWord: string;
  readonly lastSelfTest: VoiceSelfTestResult | null;
}

export interface SetVoiceMicrophonePermissionRequest {
  readonly permission: Exclude<VoiceMicrophonePermission, "not-requested">;
  readonly deviceLabel?: string | null;
}

export interface StartVoiceCaptureRequest {
  readonly mode: VoiceCaptureMode;
  readonly language: VoiceLanguage;
}

export interface StopVoiceCaptureRequest {
  readonly reason?: string;
}

export interface SubmitVoiceUtteranceRequest {
  readonly text: string;
  readonly language: VoiceLanguage;
  readonly rms: number;
  readonly durationMs: number;
  readonly sessionId?: string | null;
}

export interface SpeakVoiceRequest {
  readonly text: string;
  readonly language: VoiceLanguage;
}

export interface ConfigureVoiceRequest {
  readonly wakeWordEnabled: boolean;
  readonly wakeWord?: string;
}
