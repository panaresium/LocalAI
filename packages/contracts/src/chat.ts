export type ChatRole = "user" | "assistant" | "system";
export type ChatRunStatus = "idle" | "running" | "completed" | "cancelled" | "failed";
export type ChatAttachmentKind = "image" | "document" | "audio" | "video" | "other";
export type ChatTimelineKind = "system" | "tool" | "approval";
export type ChatTimelineState = "pending" | "running" | "completed" | "cancelled" | "failed";

export interface ChatProfileSummary {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
}

export interface ChatSessionSummary {
  readonly id: string;
  readonly preview: string;
  readonly lastActive: string;
  readonly source: string;
}

export interface ChatAttachment {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly kind: ChatAttachmentKind;
  readonly sizeBytes: number;
  readonly selectedAt: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly createdAt: string;
  readonly sessionId?: string;
  readonly attachments: readonly ChatAttachment[];
}

export interface ChatTimelineEntry {
  readonly id: number;
  readonly runId: string;
  readonly kind: ChatTimelineKind;
  readonly state: ChatTimelineState;
  readonly title: string;
  readonly detail: string;
  readonly timestamp: string;
}

export interface ChatApprovalRequest {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly risk: "low" | "medium" | "high";
  readonly status: "pending" | "approved" | "denied" | "expired";
}

export interface ChatState {
  readonly profiles: readonly ChatProfileSummary[];
  readonly sessions: readonly ChatSessionSummary[];
  readonly attachments: readonly ChatAttachment[];
  readonly approvals: readonly ChatApprovalRequest[];
  readonly timeline: readonly ChatTimelineEntry[];
  readonly activeRunId: string | null;
  readonly activeSessionId: string | null;
  readonly runStatus: ChatRunStatus;
}

export interface SendChatMessageRequest {
  readonly prompt: string;
  readonly profileId: string;
  readonly sessionId: string | null;
  readonly attachmentIds: readonly string[];
}

export interface ChatRunStartedEvent {
  readonly type: "runStarted";
  readonly runId: string;
  readonly message: ChatMessage;
  readonly state: ChatState;
}

export interface ChatAssistantContentEvent {
  readonly type: "assistantContent";
  readonly runId: string;
  readonly content: string;
}

export interface ChatRunCompletedEvent {
  readonly type: "runCompleted";
  readonly runId: string;
  readonly message: ChatMessage;
  readonly state: ChatState;
}

export interface ChatRunFailedEvent {
  readonly type: "runFailed";
  readonly runId: string;
  readonly error: string;
  readonly state: ChatState;
}

export interface ChatRunCancelledEvent {
  readonly type: "runCancelled";
  readonly runId: string;
  readonly state: ChatState;
}

export interface ChatTimelineEvent {
  readonly type: "timeline";
  readonly entry: ChatTimelineEntry;
  readonly state: ChatState;
}

export type ChatEvent =
  | ChatRunStartedEvent
  | ChatAssistantContentEvent
  | ChatRunCompletedEvent
  | ChatRunFailedEvent
  | ChatRunCancelledEvent
  | ChatTimelineEvent;
