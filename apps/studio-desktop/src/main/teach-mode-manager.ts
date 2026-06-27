import type {
  ConvertTeachWorkflowToSkillRequest,
  CreateTeachReplayRequest,
  GenerateTeachWorkflowRequest,
  RecordTeachEventRequest,
  ReviewTeachReplayRequest,
  ReviewTeachSkillCandidateRequest,
  StartTeachSessionRequest,
  TeachEventKind,
  TeachModePolicy,
  TeachModeState,
  TeachRecordedEvent,
  TeachReplayPlan,
  TeachSelector,
  TeachSession,
  TeachSessionStatus,
  TeachSkillCandidate,
  TeachVerificationRule,
  TeachWorkflow,
  TeachWorkflowParameter,
  TeachWorkflowStep
} from "@hermes-local-ai/contracts";

const MILESTONE12_TEACH_MODE_POLICY: TeachModePolicy = {
  milestone: 12,
  semanticSelectorsPreferred: true,
  coordinatesFallbackOnly: true,
  replayRequiresApproval: true,
  skillConversionRequiresApproval: true,
  maxEventsPerSession: 80,
  blockedTerms: [
    "password",
    "passcode",
    "otp",
    "mfa",
    "payment",
    "credit card",
    "delete",
    "format",
    "รหัสผ่าน",
    "ชำระเงิน"
  ]
};

export class TeachModeManager {
  private readonly sessions: TeachSession[] = [];
  private readonly workflows: TeachWorkflow[] = [];
  private readonly replayPlans: TeachReplayPlan[] = [];
  private readonly skillCandidates: TeachSkillCandidate[] = [];
  private activeSessionId: string | null = null;
  private nextSessionId = 1;
  private nextEventId = 1;
  private nextWorkflowId = 1;
  private nextReplayId = 1;
  private nextSkillId = 1;

  public getState(): TeachModeState {
    return {
      policy: MILESTONE12_TEACH_MODE_POLICY,
      activeSessionId: this.activeSessionId,
      sessions: this.sessions.map(cloneSession),
      workflows: [...this.workflows],
      replayPlans: [...this.replayPlans],
      skillCandidates: [...this.skillCandidates]
    };
  }

  public startSession(request: StartTeachSessionRequest): TeachModeState {
    if (this.activeSessionId) {
      throw new Error("A Teach Mode session is already recording.");
    }
    const name = normalizeName(request.name, "Teach workflow");
    const now = new Date().toISOString();
    const session: TeachSession = {
      id: `teach-session-${this.nextSessionId}`,
      status: "recording",
      name,
      startedAt: now,
      stoppedAt: null,
      events: []
    };
    this.nextSessionId += 1;
    this.sessions.unshift(session);
    this.sessions.splice(12);
    this.activeSessionId = session.id;
    return this.getState();
  }

  public recordEvent(request: RecordTeachEventRequest): TeachModeState {
    const session = this.getActiveRecordingSession();
    if (session.events.length >= MILESTONE12_TEACH_MODE_POLICY.maxEventsPerSession) {
      throw new Error("Teach Mode session reached the event limit.");
    }
    const kind = normalizeEventKind(request.kind);
    const selector = normalizeSelector(request.selector);
    const text = normalizeOptionalText(request.text);
    const filePath = normalizeOptionalPath(request.filePath);
    const screenshotPath = normalizeOptionalPath(request.screenshotPath);
    const waitCondition = normalizeOptionalText(request.waitCondition);
    const note = normalizeOptionalText(request.note) ?? "";
    rejectSensitiveText([text, filePath, waitCondition, note]);

    const event: TeachRecordedEvent = {
      id: `teach-event-${this.nextEventId}`,
      index: session.events.length,
      kind,
      timestamp: new Date().toISOString(),
      selector,
      text,
      filePath,
      screenshotPath,
      waitCondition,
      note,
      coordinateFallbackUsed: selector.bounds !== null && selector.automationId === null && selector.name === null
    };
    this.nextEventId += 1;
    replaceSession(this.sessions, session.id, {
      ...session,
      events: [...session.events, event]
    });
    return this.getState();
  }

  public stopSession(): TeachModeState {
    if (!this.activeSessionId) {
      throw new Error("No Teach Mode session is recording.");
    }
    const session = this.findSession(this.activeSessionId);
    replaceSession(this.sessions, session.id, {
      ...session,
      status: "stopped",
      stoppedAt: new Date().toISOString()
    });
    this.activeSessionId = null;
    return this.getState();
  }

  public generateWorkflow(request: GenerateTeachWorkflowRequest): TeachModeState {
    const session = this.findSession(request.sessionId);
    if (session.status === "recording") {
      throw new Error("Stop the Teach Mode session before generating a workflow.");
    }
    if (session.events.length === 0) {
      throw new Error("Teach Mode workflow requires at least one recorded event.");
    }
    const name = normalizeName(request.name ?? session.name, session.name);
    const parameters = extractParameters(session.events);
    const steps = session.events.map((event) => eventToStep(event, parameters));
    const verification = buildVerificationRules(session.events);
    const reliability = scoreReliability(session.events, steps, verification);
    const workflow: TeachWorkflow = {
      id: `teach-workflow-${this.nextWorkflowId}`,
      sessionId: session.id,
      name,
      yaml: buildWorkflowYaml(name, parameters, steps, verification),
      parameters,
      steps,
      verification,
      reliabilityScore: reliability.score,
      reliabilityNotes: reliability.notes,
      createdAt: new Date().toISOString()
    };
    this.nextWorkflowId += 1;
    this.workflows.unshift(workflow);
    this.workflows.splice(12);
    replaceSession(this.sessions, session.id, {
      ...session,
      status: "workflow-ready"
    });
    return this.getState();
  }

  public createReplay(request: CreateTeachReplayRequest): TeachModeState {
    const workflow = this.findWorkflow(request.workflowId);
    const blockedReasons = buildReplayBlockedReasons(workflow);
    const replay: TeachReplayPlan = {
      id: `teach-replay-${this.nextReplayId}`,
      workflowId: workflow.id,
      status: "draft",
      dryRun: true,
      requiresApproval: true,
      stepCount: workflow.steps.length,
      blockedReasons,
      createdAt: new Date().toISOString(),
      reviewedAt: null
    };
    this.nextReplayId += 1;
    this.replayPlans.unshift(replay);
    this.replayPlans.splice(12);
    return this.getState();
  }

  public reviewReplay(request: ReviewTeachReplayRequest): TeachModeState {
    const index = this.replayPlans.findIndex((plan) => plan.id === request.replayId);
    if (index < 0) {
      throw new Error("Unknown Teach Mode replay plan.");
    }
    const existing = this.replayPlans[index];
    if (!existing || existing.status !== "draft") {
      throw new Error("Only draft replay plans can be reviewed.");
    }
    if (request.decision === "approve" && existing.blockedReasons.length > 0) {
      throw new Error("Replay plan with blocked reasons cannot be approved.");
    }
    this.replayPlans[index] = {
      ...existing,
      status: request.decision === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString()
    };
    return this.getState();
  }

  public convertToSkill(request: ConvertTeachWorkflowToSkillRequest): TeachModeState {
    const workflow = this.findWorkflow(request.workflowId);
    const candidate: TeachSkillCandidate = {
      id: `teach-skill-${this.nextSkillId}`,
      workflowId: workflow.id,
      name: workflow.name,
      summary: `Replay supervised workflow ${workflow.name} with ${workflow.steps.length} step(s).`,
      body: buildSkillBody(workflow),
      status: "pending-approval",
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewNote: null
    };
    this.nextSkillId += 1;
    this.skillCandidates.unshift(candidate);
    this.skillCandidates.splice(12);
    return this.getState();
  }

  public reviewSkillCandidate(request: ReviewTeachSkillCandidateRequest): TeachModeState {
    const index = this.skillCandidates.findIndex((candidate) => candidate.id === request.candidateId);
    if (index < 0) {
      throw new Error("Unknown Teach Mode skill candidate.");
    }
    const existing = this.skillCandidates[index];
    if (!existing || existing.status !== "pending-approval") {
      throw new Error("Only pending Teach Mode skill candidates can be reviewed.");
    }
    this.skillCandidates[index] = {
      ...existing,
      status: request.decision === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewNote: normalizeOptionalText(request.reviewNote)
    };
    return this.getState();
  }

  private getActiveRecordingSession(): TeachSession {
    if (!this.activeSessionId) {
      throw new Error("Start a Teach Mode session before recording events.");
    }
    const session = this.findSession(this.activeSessionId);
    if (session.status !== "recording") {
      throw new Error("Teach Mode session is not recording.");
    }
    return session;
  }

  private findSession(sessionId: string): TeachSession {
    const session = this.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      throw new Error("Unknown Teach Mode session.");
    }
    return session;
  }

  private findWorkflow(workflowId: string): TeachWorkflow {
    const workflow = this.workflows.find((candidate) => candidate.id === workflowId);
    if (!workflow) {
      throw new Error("Unknown Teach Mode workflow.");
    }
    return workflow;
  }
}

function normalizeName(value: string, fallback: string): string {
  const name = value.trim() || fallback;
  if (name.length > 100) {
    throw new Error("Teach Mode name is too long.");
  }
  rejectSensitiveText([name]);
  return name;
}

function normalizeEventKind(value: unknown): TeachEventKind {
  const allowed: readonly TeachEventKind[] = [
    "app.focus",
    "window.observe",
    "ui.invoke",
    "ui.set_value",
    "keyboard.input",
    "mouse.click",
    "clipboard.read",
    "file.opened",
    "file.created",
    "wait.condition",
    "screenshot.capture",
    "final.state"
  ];
  if (!allowed.includes(value as TeachEventKind)) {
    throw new Error("Invalid Teach Mode event kind.");
  }
  return value as TeachEventKind;
}

function normalizeSelector(value: unknown): TeachSelector {
  if (!isRecord(value)) {
    throw new Error("Invalid Teach Mode selector.");
  }
  const selector: TeachSelector = {
    appProcess: normalizeOptionalText(value.appProcess),
    windowTitle: normalizeOptionalText(value.windowTitle),
    automationId: normalizeOptionalText(value.automationId),
    name: normalizeOptionalText(value.name),
    controlType: normalizeOptionalText(value.controlType),
    bounds: normalizeBounds(value.bounds),
    semanticPath: Array.isArray(value.semanticPath)
      ? value.semanticPath.map((part) => {
          if (typeof part !== "string" || part.length > 120) {
            throw new Error("Invalid Teach Mode semantic path.");
          }
          return part;
        })
      : []
  };
  rejectSensitiveText([
    selector.appProcess,
    selector.windowTitle,
    selector.automationId,
    selector.name,
    selector.controlType,
    ...selector.semanticPath
  ]);
  return selector;
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Invalid Teach Mode text value.");
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (text.length > 500) {
    throw new Error("Teach Mode text value is too long.");
  }
  return text;
}

function normalizeOptionalPath(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) {
    return null;
  }
  if (text.includes("\0")) {
    throw new Error("Invalid Teach Mode path.");
  }
  return text;
}

function normalizeBounds(value: unknown): TeachSelector["bounds"] {
  if (value === undefined || value === null) {
    return null;
  }
  if (
    !isRecord(value) ||
    typeof value.left !== "number" ||
    typeof value.top !== "number" ||
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    !Number.isInteger(value.left) ||
    !Number.isInteger(value.top) ||
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    throw new Error("Invalid Teach Mode bounds.");
  }
  return {
    left: value.left,
    top: value.top,
    width: value.width,
    height: value.height
  };
}

function rejectSensitiveText(values: readonly (string | null | undefined)[]): void {
  const joined = values.filter(Boolean).join(" ").toLowerCase();
  const blocked = MILESTONE12_TEACH_MODE_POLICY.blockedTerms.find((term) => joined.includes(term.toLowerCase()));
  if (blocked) {
    throw new Error(`Blocked sensitive Teach Mode content: ${blocked}.`);
  }
}

function extractParameters(events: readonly TeachRecordedEvent[]): readonly TeachWorkflowParameter[] {
  const parameters: TeachWorkflowParameter[] = [];
  for (const event of events) {
    if ((event.kind === "ui.set_value" || event.kind === "keyboard.input") && event.text) {
      parameters.push({
        name: uniqueParameterName(parameters, `${slug(event.selector.name ?? event.selector.automationId ?? "input")}_text`),
        kind: "text",
        defaultValue: event.text,
        sourceEventId: event.id
      });
    }
    if ((event.kind === "file.opened" || event.kind === "file.created") && event.filePath) {
      parameters.push({
        name: uniqueParameterName(parameters, event.kind === "file.opened" ? "input_file" : "output_file"),
        kind: "file",
        defaultValue: event.filePath,
        sourceEventId: event.id
      });
    }
    if (event.kind === "wait.condition" && event.waitCondition) {
      parameters.push({
        name: uniqueParameterName(parameters, "wait_condition"),
        kind: "text",
        defaultValue: event.waitCondition,
        sourceEventId: event.id
      });
    }
  }
  return parameters;
}

function eventToStep(event: TeachRecordedEvent, parameters: readonly TeachWorkflowParameter[]): TeachWorkflowStep {
  const parameter = parameters.find((candidate) => candidate.sourceEventId === event.id);
  const valueTemplate = parameter ? `{{ ${parameter.name} }}` : event.text ?? event.filePath ?? event.waitCondition;
  return {
    id: `step-${event.index + 1}`,
    eventId: event.id,
    action: event.kind,
    selector: event.selector,
    valueTemplate,
    coordinateFallbackAllowed: event.coordinateFallbackUsed,
    description: describeEvent(event, valueTemplate)
  };
}

function buildVerificationRules(events: readonly TeachRecordedEvent[]): readonly TeachVerificationRule[] {
  const final = findLastEvent(events, (event) => event.kind === "final.state");
  const createdFile = findLastEvent(events, (event) => event.kind === "file.created" && Boolean(event.filePath));
  const rules: TeachVerificationRule[] = [];
  if (createdFile?.filePath) {
    rules.push({
      id: "verify-file-exists",
      kind: "file-exists",
      expected: createdFile.filePath,
      sourceEventId: createdFile.id
    });
    rules.push({
      id: "verify-file-size",
      kind: "file-size-greater-than",
      expected: "0",
      sourceEventId: createdFile.id
    });
  }
  if (final?.text) {
    rules.push({
      id: "verify-final-state",
      kind: "ui-tree-contains",
      expected: final.text,
      sourceEventId: final.id
    });
  }
  if (rules.length === 0) {
    rules.push({
      id: "verify-manual",
      kind: "manual",
      expected: "User confirms the demonstrated task completed correctly.",
      sourceEventId: final?.id ?? null
    });
  }
  return rules;
}

function findLastEvent(
  events: readonly TeachRecordedEvent[],
  predicate: (event: TeachRecordedEvent) => boolean
): TeachRecordedEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && predicate(event)) {
      return event;
    }
  }
  return null;
}

function scoreReliability(
  events: readonly TeachRecordedEvent[],
  steps: readonly TeachWorkflowStep[],
  verification: readonly TeachVerificationRule[]
): { readonly score: number; readonly notes: readonly string[] } {
  let score = 0.45;
  const notes: string[] = [];
  const semanticSteps = steps.filter((step) => step.selector.automationId || step.selector.name || step.selector.semanticPath.length > 0).length;
  const coordinateSteps = steps.filter((step) => step.coordinateFallbackAllowed).length;
  score += Math.min(0.25, semanticSteps * 0.04);
  score += Math.min(0.18, verification.length * 0.06);
  score += Math.min(0.12, events.length * 0.01);
  if (coordinateSteps > 0) {
    score -= Math.min(0.24, coordinateSteps * 0.06);
    notes.push(`${coordinateSteps} step(s) require coordinate fallback.`);
  }
  if (verification.some((rule) => rule.kind !== "manual")) {
    notes.push("Workflow has objective verification.");
  } else {
    notes.push("Workflow relies on manual verification.");
  }
  if (semanticSteps === steps.length) {
    notes.push("All steps have semantic selectors.");
  }
  return {
    score: Math.max(0.05, Math.min(0.99, Number(score.toFixed(2)))),
    notes
  };
}

function buildReplayBlockedReasons(workflow: TeachWorkflow): readonly string[] {
  const reasons: string[] = [];
  if (workflow.reliabilityScore < 0.55) {
    reasons.push("Reliability score is below replay threshold.");
  }
  if (workflow.steps.some((step) => step.coordinateFallbackAllowed)) {
    reasons.push("Coordinate fallback steps require user review before replay.");
  }
  return reasons;
}

function buildWorkflowYaml(
  name: string,
  parameters: readonly TeachWorkflowParameter[],
  steps: readonly TeachWorkflowStep[],
  verification: readonly TeachVerificationRule[]
): string {
  const lines = [`name: ${quoteYaml(name)}`, "inputs:"];
  if (parameters.length === 0) {
    lines.push("  none: manual");
  } else {
    for (const parameter of parameters) {
      lines.push(`  ${parameter.name}: ${parameter.kind}`);
    }
  }
  lines.push("steps:");
  for (const step of steps) {
    lines.push(`  - id: ${step.id}`);
    lines.push(`    action: ${step.action}`);
    lines.push(`    selector: ${quoteYaml(selectorLabel(step.selector))}`);
    if (step.valueTemplate) {
      lines.push(`    value: ${quoteYaml(step.valueTemplate)}`);
    }
    lines.push(`    coordinate_fallback: ${step.coordinateFallbackAllowed ? "true" : "false"}`);
  }
  lines.push("verification:");
  for (const rule of verification) {
    lines.push(`  - ${rule.kind}: ${quoteYaml(rule.expected)}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildSkillBody(workflow: TeachWorkflow): string {
  return [
    `# ${workflow.name}`,
    "",
    "Use this skill when the user asks to replay the approved workflow below.",
    "",
    "Safety:",
    "- Ask for explicit approval before replay.",
    "- Prefer semantic selectors. Coordinates are fallback only.",
    "- Stop for credentials, payments, destructive operations, or unexpected UI.",
    "",
    "Workflow:",
    "```yaml",
    workflow.yaml.trimEnd(),
    "```",
    "",
    `Reliability score: ${workflow.reliabilityScore}`,
    "",
    "Reliability notes:",
    ...workflow.reliabilityNotes.map((note) => `- ${note}`)
  ].join("\n");
}

function describeEvent(event: TeachRecordedEvent, valueTemplate: string | null): string {
  const target = selectorLabel(event.selector);
  return valueTemplate ? `${event.kind} ${target} with ${valueTemplate}` : `${event.kind} ${target}`;
}

function selectorLabel(selector: TeachSelector): string {
  if (selector.semanticPath.length > 0) {
    return selector.semanticPath.join(" > ");
  }
  if (selector.automationId) {
    return `automationId:${selector.automationId}`;
  }
  if (selector.name) {
    return `name:${selector.name}`;
  }
  if (selector.bounds) {
    return `bounds:${selector.bounds.left},${selector.bounds.top},${selector.bounds.width},${selector.bounds.height}`;
  }
  return selector.windowTitle ?? selector.appProcess ?? "current-context";
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"")}"`;
}

function uniqueParameterName(existing: readonly TeachWorkflowParameter[], base: string): string {
  let name = slug(base);
  let index = 2;
  while (existing.some((parameter) => parameter.name === name)) {
    name = `${slug(base)}_${index}`;
    index += 1;
  }
  return name;
}

function slug(value: string): string {
  const slugged = value.toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
  return slugged || "value";
}

function cloneSession(session: TeachSession): TeachSession {
  return {
    ...session,
    events: [...session.events]
  };
}

function replaceSession(sessions: TeachSession[], sessionId: string, nextSession: TeachSession): void {
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) {
    throw new Error("Unknown Teach Mode session.");
  }
  sessions[index] = nextSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
