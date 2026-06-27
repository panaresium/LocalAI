export type ElevatedHelperSignatureStatus = "missing" | "unsigned" | "signed";
export type ElevatedHelperSessionStatus = "pending-manual-start" | "active" | "expired" | "revoked" | "rejected";
export type ElevatedHelperAuditKind =
  | "helper.probed"
  | "session.requested"
  | "session.confirmed"
  | "session.rejected"
  | "session.expired"
  | "session.revoked";

export interface ElevatedHelperPolicy {
  readonly milestone: 14;
  readonly optionalHelper: boolean;
  readonly manualUacStartupOnly: boolean;
  readonly silentElevationAllowed: false;
  readonly secureDesktopAutomationAllowed: false;
  readonly requiresSignedHelperForTrustedSession: boolean;
  readonly maxSessionMinutes: number;
  readonly auditRequired: boolean;
  readonly allowedHelperCommands: readonly string[];
  readonly blockedActions: readonly string[];
}

export const MILESTONE14_ELEVATED_HELPER_POLICY: ElevatedHelperPolicy = {
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

export interface ElevatedHelperBinaryStatus {
  readonly projectPath: string;
  readonly executablePath: string;
  readonly exists: boolean;
  readonly sha256: string | null;
  readonly signatureStatus: ElevatedHelperSignatureStatus;
  readonly trustedForElevatedSession: boolean;
  readonly detail: string;
}

export interface ElevatedHelperLaunchInstruction {
  readonly sessionId: string;
  readonly powershellCommand: string;
  readonly expiresAt: string;
  readonly requiresManualUac: true;
  readonly note: string;
}

export interface ElevatedHelperSessionGrant {
  readonly id: string;
  readonly status: ElevatedHelperSessionStatus;
  readonly purpose: string;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly durationMinutes: number;
  readonly approvalCode: string;
  readonly helperProcessId: number | null;
  readonly helperElevated: boolean;
  readonly reviewedAt: string | null;
  readonly rejectionReason: string | null;
}

export interface ElevatedHelperAuditEvent {
  readonly id: number;
  readonly timestamp: string;
  readonly kind: ElevatedHelperAuditKind;
  readonly sessionId: string | null;
  readonly actor: "studio" | "user" | "helper";
  readonly summary: string;
  readonly detail: string;
}

export interface PrepareElevatedHelperLaunchRequest {
  readonly purpose: string;
  readonly durationMinutes: number;
}

export interface ConfirmElevatedHelperSessionRequest {
  readonly sessionId: string;
  readonly approvalCode: string;
  readonly helperProcessId: number;
  readonly helperElevated: boolean;
}

export interface RevokeElevatedHelperSessionRequest {
  readonly sessionId: string;
  readonly reason?: string;
}

export interface ElevatedHelperState {
  readonly policy: ElevatedHelperPolicy;
  readonly helper: ElevatedHelperBinaryStatus;
  readonly launchInstruction: ElevatedHelperLaunchInstruction | null;
  readonly sessions: readonly ElevatedHelperSessionGrant[];
  readonly audit: readonly ElevatedHelperAuditEvent[];
}
