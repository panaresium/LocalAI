export type LearningScope = "user" | "profile" | "project" | "session";
export type LearningCandidateStatus = "pending" | "approved" | "rejected";
export type LearningReviewDecision = "approve" | "reject";
export type LearningSourceKind = "chat" | "task" | "manual" | "knowledge" | "workflow";

export interface LearningProvenance {
  readonly sourceKind: LearningSourceKind;
  readonly sourceId: string | null;
  readonly profileId: string | null;
  readonly projectId: string | null;
  readonly note: string;
  readonly createdAt: string;
}

export interface LearningMemoryCandidate {
  readonly id: string;
  readonly scope: LearningScope;
  readonly content: string;
  readonly confidence: number;
  readonly status: LearningCandidateStatus;
  readonly provenance: LearningProvenance;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface LearningMemoryItem {
  readonly id: string;
  readonly scope: LearningScope;
  readonly content: string;
  readonly sourceCandidateId: string;
  readonly confidence: number;
  readonly createdAt: string;
  readonly lastVerifiedAt: string;
  readonly expiresAt: string | null;
  readonly supersededBy: string | null;
  readonly provenance: LearningProvenance;
}

export interface LearningSkillCandidate {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly body: string;
  readonly status: LearningCandidateStatus;
  readonly provenance: LearningProvenance;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface LearningSkillVersion {
  readonly version: number;
  readonly body: string;
  readonly summary: string;
  readonly sourceCandidateId: string;
  readonly createdAt: string;
  readonly provenance: LearningProvenance;
}

export interface LearningSkillItem {
  readonly id: string;
  readonly name: string;
  readonly activeVersion: number;
  readonly versions: readonly LearningSkillVersion[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LearningAuditEvent {
  readonly id: string;
  readonly type: "memory.proposed" | "memory.approved" | "memory.rejected" | "skill.proposed" | "skill.approved" | "skill.rejected" | "skill.rollback";
  readonly targetId: string;
  readonly detail: string;
  readonly createdAt: string;
}

export interface LearningState {
  readonly memoryCandidates: readonly LearningMemoryCandidate[];
  readonly memoryItems: readonly LearningMemoryItem[];
  readonly skillCandidates: readonly LearningSkillCandidate[];
  readonly skills: readonly LearningSkillItem[];
  readonly audit: readonly LearningAuditEvent[];
}

export interface ProposeMemoryCandidateRequest {
  readonly scope: LearningScope;
  readonly content: string;
  readonly confidence: number;
  readonly provenance: Omit<LearningProvenance, "createdAt">;
}

export interface ReviewMemoryCandidateRequest {
  readonly candidateId: string;
  readonly decision: LearningReviewDecision;
  readonly editedContent?: string;
  readonly reviewNote?: string;
  readonly expiresAt?: string | null;
}

export interface ProposeSkillCandidateRequest {
  readonly name: string;
  readonly summary: string;
  readonly body: string;
  readonly provenance: Omit<LearningProvenance, "createdAt">;
}

export interface ReviewSkillCandidateRequest {
  readonly candidateId: string;
  readonly decision: LearningReviewDecision;
  readonly editedBody?: string;
  readonly editedSummary?: string;
  readonly reviewNote?: string;
}

export interface RollbackSkillVersionRequest {
  readonly skillId: string;
  readonly version: number;
  readonly reviewNote?: string;
}
