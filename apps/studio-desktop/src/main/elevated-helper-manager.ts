import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ConfirmElevatedHelperSessionRequest,
  ElevatedHelperAuditEvent,
  ElevatedHelperAuditKind,
  ElevatedHelperBinaryStatus,
  ElevatedHelperLaunchInstruction,
  ElevatedHelperPolicy,
  ElevatedHelperSessionGrant,
  ElevatedHelperState,
  PrepareElevatedHelperLaunchRequest,
  RevokeElevatedHelperSessionRequest
} from "@hermes-local-ai/contracts";

const MILESTONE14_ELEVATED_HELPER_POLICY: ElevatedHelperPolicy = {
  milestone: 14,
  optionalHelper: true,
  manualUacStartupOnly: true,
  silentElevationAllowed: false,
  secureDesktopAutomationAllowed: false,
  requiresSignedHelperForTrustedSession: true,
  maxSessionMinutes: 15,
  auditRequired: true,
  allowedHelperCommands: [
    "helper.probe",
    "session.request",
    "session.confirm",
    "session.revoke",
    "audit.export"
  ],
  blockedActions: [
    "uac.automate",
    "secure-desktop.automation",
    "silent-elevation",
    "credential.enter",
    "payment.confirm",
    "destructive.admin"
  ]
};

const SENSITIVE_PURPOSE_PATTERN = /\b(password|passcode|otp|mfa|payment|credit card|api[-_\s]?key|secret|token|credential)\b/iu;

export class ElevatedHelperManager {
  private readonly projectPath: string;
  private readonly executablePath: string;
  private readonly auditOutputDir: string;
  private readonly sessions: ElevatedHelperSessionGrant[] = [];
  private readonly audit: ElevatedHelperAuditEvent[] = [];
  private launchInstruction: ElevatedHelperLaunchInstruction | null = null;
  private nextAuditId = 1;
  private nextSessionId = 1;

  public constructor(private readonly root: string) {
    this.projectPath = join(root, "services", "elevated-helper", "HermesLocalAI.ElevatedHelper.csproj");
    this.executablePath = join(root, "services", "elevated-helper", "bin", "Release", "net8.0-windows", "HermesLocalAI.ElevatedHelper.exe");
    this.auditOutputDir = join(root, "artifacts", "milestone14", "helper-audit");
  }

  public getState(now = new Date()): ElevatedHelperState {
    this.expireSessions(now);
    return {
      policy: MILESTONE14_ELEVATED_HELPER_POLICY,
      helper: this.probeBinary(),
      launchInstruction: this.launchInstruction,
      sessions: [...this.sessions],
      audit: [...this.audit]
    };
  }

  public probeHelper(): ElevatedHelperState {
    const helper = this.probeBinary();
    this.appendAudit("helper.probed", null, "studio", "Elevated helper binary probed.", helper.detail);
    return this.getState();
  }

  public prepareLaunch(request: PrepareElevatedHelperLaunchRequest): ElevatedHelperState {
    const purpose = normalizePurpose(request.purpose);
    const durationMinutes = normalizeDuration(request.durationMinutes);
    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + durationMinutes * 60_000);
    const sessionId = `elevated-session-${this.nextSessionId}`;
    const approvalCode = randomBytes(4).toString("hex").toUpperCase();
    this.nextSessionId += 1;

    const session: ElevatedHelperSessionGrant = {
      id: sessionId,
      status: "pending-manual-start",
      purpose,
      requestedAt: requestedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationMinutes,
      approvalCode,
      helperProcessId: null,
      helperElevated: false,
      reviewedAt: null,
      rejectionReason: null
    };
    this.sessions.unshift(session);
    this.sessions.splice(12);

    const auditOutput = join(this.auditOutputDir, `${sessionId}.json`);
    this.launchInstruction = {
      sessionId,
      powershellCommand: buildManualLaunchCommand(this.executablePath, sessionId, approvalCode, expiresAt.toISOString(), auditOutput),
      expiresAt: expiresAt.toISOString(),
      requiresManualUac: true,
      note: "Run this command manually in PowerShell only if you want to start the optional helper. Studio will not automate UAC or secure desktop."
    };
    this.appendAudit("session.requested", sessionId, "studio", "Time-limited elevated helper session requested.", purpose);
    return this.getState();
  }

  public confirmSession(request: ConfirmElevatedHelperSessionRequest): ElevatedHelperState {
    const index = this.findSessionIndex(request.sessionId);
    const session = this.sessions[index];
    if (!session || session.status !== "pending-manual-start") {
      throw new Error("Only pending elevated helper sessions can be confirmed.");
    }

    const helper = this.probeBinary();
    const rejectionReason = buildConfirmationRejection(session, request, helper);
    const reviewedAt = new Date().toISOString();
    if (rejectionReason) {
      this.sessions[index] = {
        ...session,
        status: "rejected",
        helperProcessId: normalizeProcessId(request.helperProcessId),
        helperElevated: request.helperElevated,
        reviewedAt,
        rejectionReason
      };
      this.appendAudit("session.rejected", session.id, "studio", "Elevated helper session rejected.", rejectionReason);
      return this.getState();
    }

    this.sessions[index] = {
      ...session,
      status: "active",
      helperProcessId: normalizeProcessId(request.helperProcessId),
      helperElevated: request.helperElevated,
      reviewedAt,
      rejectionReason: null
    };
    this.appendAudit("session.confirmed", session.id, "helper", "Elevated helper session confirmed.", "Session is time-limited and audit logged.");
    return this.getState();
  }

  public revokeSession(request: RevokeElevatedHelperSessionRequest): ElevatedHelperState {
    const index = this.findSessionIndex(request.sessionId);
    const session = this.sessions[index];
    if (!session || session.status === "revoked") {
      throw new Error("Elevated helper session cannot be revoked.");
    }

    const reason = request.reason === undefined ? "User revoked elevated helper session." : normalizeReviewText(request.reason);
    this.sessions[index] = {
      ...session,
      status: "revoked",
      reviewedAt: new Date().toISOString(),
      rejectionReason: reason
    };
    this.appendAudit("session.revoked", session.id, "user", "Elevated helper session revoked.", reason);
    return this.getState();
  }

  private findSessionIndex(sessionId: string): number {
    if (!sessionId) {
      throw new Error("Invalid elevated helper session id.");
    }
    const index = this.sessions.findIndex((session) => session.id === sessionId);
    if (index < 0) {
      throw new Error("Unknown elevated helper session.");
    }
    return index;
  }

  private expireSessions(now: Date): void {
    for (const [index, session] of this.sessions.entries()) {
      if ((session.status === "pending-manual-start" || session.status === "active") && Date.parse(session.expiresAt) <= now.getTime()) {
        this.sessions[index] = {
          ...session,
          status: "expired",
          reviewedAt: now.toISOString(),
          rejectionReason: "Elevated helper session expired."
        };
        this.appendAudit("session.expired", session.id, "studio", "Elevated helper session expired.", session.purpose);
      }
    }
  }

  private probeBinary(): ElevatedHelperBinaryStatus {
    const exists = existsSync(this.executablePath);
    const sha256 = exists ? createHash("sha256").update(readFileSync(this.executablePath)).digest("hex") : null;
    const signatureStatus = exists ? "unsigned" : "missing";
    const trustedForElevatedSession = false;
    return {
      projectPath: this.projectPath,
      executablePath: this.executablePath,
      exists,
      sha256,
      signatureStatus,
      trustedForElevatedSession,
      detail: exists
        ? "Development helper binary exists but is not Authenticode-signed; trusted elevated sessions remain disabled."
        : "Elevated helper binary is not built yet."
    };
  }

  private appendAudit(
    kind: ElevatedHelperAuditKind,
    sessionId: string | null,
    actor: ElevatedHelperAuditEvent["actor"],
    summary: string,
    detail: string
  ): void {
    this.audit.unshift({
      id: this.nextAuditId,
      timestamp: new Date().toISOString(),
      kind,
      sessionId,
      actor,
      summary,
      detail
    });
    this.nextAuditId += 1;
    this.audit.splice(40);
  }
}

function buildConfirmationRejection(
  session: ElevatedHelperSessionGrant,
  request: ConfirmElevatedHelperSessionRequest,
  helper: ElevatedHelperBinaryStatus
): string | null {
  if (request.approvalCode !== session.approvalCode) {
    return "Approval code did not match the pending session.";
  }
  if (!request.helperElevated) {
    return "Helper did not report an elevated administrator token.";
  }
  if (!helper.trustedForElevatedSession) {
    return "Helper is not trusted for elevated sessions because it is not signed.";
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    return "Pending elevated helper session expired before confirmation.";
  }
  return null;
}

function buildManualLaunchCommand(
  executablePath: string,
  sessionId: string,
  approvalCode: string,
  expiresAt: string,
  auditOutput: string
): string {
  const argumentList = [
    "session.accept",
    "--session-id",
    sessionId,
    "--approval-code",
    approvalCode,
    "--expires-at",
    expiresAt,
    "--audit-output",
    auditOutput
  ].map(quotePowerShellArgument).join(" ");
  return `Start-Process -FilePath ${quotePowerShellArgument(executablePath)} -ArgumentList ${quotePowerShellArgument(argumentList)} -Verb RunAs -Wait`;
}

function quotePowerShellArgument(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`;
}

function normalizePurpose(value: string): string {
  const text = value.trim();
  if (!text || text.length > 240) {
    throw new Error("Invalid elevated helper purpose.");
  }
  if (SENSITIVE_PURPOSE_PATTERN.test(text)) {
    throw new Error("Sensitive elevated helper purpose is blocked.");
  }
  return text;
}

function normalizeDuration(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MILESTONE14_ELEVATED_HELPER_POLICY.maxSessionMinutes) {
    throw new Error("Invalid elevated helper session duration.");
  }
  return value;
}

function normalizeProcessId(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error("Invalid elevated helper process id.");
  }
  return value;
}

function normalizeReviewText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 240) {
    throw new Error("Invalid elevated helper review text.");
  }
  return text;
}
