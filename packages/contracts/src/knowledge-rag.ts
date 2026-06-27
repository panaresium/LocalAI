export type KnowledgeScope = "global" | "profile" | "project" | "session";
export type KnowledgeDocumentKind = "markdown" | "text" | "json" | "yaml" | "csv" | "html" | "code" | "unsupported";
export type KnowledgeDocumentStatus = "ready" | "rejected" | "failed";
export type KnowledgeBaseStatus = "empty" | "ready" | "degraded";

export interface KnowledgeBaseSummary {
  readonly id: string;
  readonly label: string;
  readonly scope: KnowledgeScope;
  readonly ownerId: string | null;
  readonly status: KnowledgeBaseStatus;
  readonly documentCount: number;
  readonly chunkCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeDocumentSummary {
  readonly id: string;
  readonly baseId: string;
  readonly name: string;
  readonly path: string;
  readonly kind: KnowledgeDocumentKind;
  readonly status: KnowledgeDocumentStatus;
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly chunkCount: number;
  readonly indexedAt: string;
  readonly rejectionReason: string | null;
}

export interface KnowledgeCitation {
  readonly documentId: string;
  readonly chunkId: string;
  readonly documentName: string;
  readonly path: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly score: number;
  readonly snippet: string;
}

export interface KnowledgeSearchResult {
  readonly id: string;
  readonly baseId: string;
  readonly query: string;
  readonly answer: string;
  readonly citations: readonly KnowledgeCitation[];
  readonly notFound: boolean;
  readonly usedHybridRetrieval: boolean;
  readonly reranked: boolean;
  readonly checkedAt: string;
}

export interface KnowledgeEvaluationQuestion {
  readonly id: string;
  readonly question: string;
  readonly expectedDocumentName?: string;
  readonly expectedSnippet?: string;
}

export interface KnowledgeEvaluationItem {
  readonly id: string;
  readonly question: string;
  readonly passed: boolean;
  readonly topDocumentName: string | null;
  readonly detail: string;
}

export interface KnowledgeEvaluationResult {
  readonly id: string;
  readonly baseId: string;
  readonly passed: number;
  readonly total: number;
  readonly items: readonly KnowledgeEvaluationItem[];
  readonly checkedAt: string;
}

export interface KnowledgeRagState {
  readonly bases: readonly KnowledgeBaseSummary[];
  readonly documents: readonly KnowledgeDocumentSummary[];
  readonly recentSearches: readonly KnowledgeSearchResult[];
  readonly evaluations: readonly KnowledgeEvaluationResult[];
}

export interface SaveKnowledgeBaseRequest {
  readonly id: string;
  readonly label: string;
  readonly scope: KnowledgeScope;
  readonly ownerId: string | null;
}

export interface IngestKnowledgeFilesRequest {
  readonly baseId: string;
  readonly filePaths: readonly string[];
}

export interface IngestKnowledgeFilesResult {
  readonly baseId: string;
  readonly accepted: readonly KnowledgeDocumentSummary[];
  readonly rejected: readonly KnowledgeDocumentSummary[];
}

export interface SearchKnowledgeRequest {
  readonly baseId: string;
  readonly query: string;
  readonly limit?: number;
}

export interface EvaluateKnowledgeRequest {
  readonly baseId: string;
  readonly questions: readonly KnowledgeEvaluationQuestion[];
}
