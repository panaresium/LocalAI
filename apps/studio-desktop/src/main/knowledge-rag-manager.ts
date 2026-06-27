import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import type {
  EvaluateKnowledgeRequest,
  IngestKnowledgeFilesRequest,
  IngestKnowledgeFilesResult,
  KnowledgeBaseSummary,
  KnowledgeCitation,
  KnowledgeDocumentKind,
  KnowledgeDocumentStatus,
  KnowledgeDocumentSummary,
  KnowledgeEvaluationItem,
  KnowledgeEvaluationResult,
  KnowledgeRagState,
  KnowledgeScope,
  KnowledgeSearchResult,
  SaveKnowledgeBaseRequest,
  SearchKnowledgeRequest
} from "@hermes-local-ai/contracts";

interface KnowledgeChunkRecord {
  readonly id: string;
  readonly baseId: string;
  readonly documentId: string;
  readonly text: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly ordinal: number;
  readonly terms: readonly string[];
}

interface KnowledgeRegistry {
  readonly schemaVersion: 1;
  readonly bases: readonly KnowledgeBaseSummary[];
  readonly documents: readonly KnowledgeDocumentSummary[];
  readonly chunks: readonly KnowledgeChunkRecord[];
  readonly recentSearches: readonly KnowledgeSearchResult[];
  readonly evaluations: readonly KnowledgeEvaluationResult[];
}

interface ExtractedDocument {
  readonly kind: KnowledgeDocumentKind;
  readonly text: string;
}

export interface KnowledgeRagManagerOptions {
  readonly now?: () => Date;
  readonly maxFileBytes?: number;
}

const SCHEMA_VERSION = 1;
const MAX_RECENT_SEARCHES = 20;
const MAX_EVALUATIONS = 20;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_CHARS = 1200;
const MAX_CHUNK_CHARS = 900;
const BASE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with"
]);

export class KnowledgeRagManager {
  private readonly root: string;
  private readonly knowledgeRoot: string;
  private readonly registryPath: string;
  private readonly now: () => Date;
  private readonly maxFileBytes: number;

  public constructor(root: string, options: KnowledgeRagManagerOptions = {}) {
    this.root = resolve(root);
    this.knowledgeRoot = join(this.root, "knowledge");
    this.registryPath = join(this.knowledgeRoot, "knowledge-registry.json");
    this.now = options.now ?? (() => new Date());
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  }

  public async getState(): Promise<KnowledgeRagState> {
    const registry = await this.readRegistry();
    return {
      bases: registry.bases,
      documents: registry.documents,
      recentSearches: registry.recentSearches,
      evaluations: registry.evaluations
    };
  }

  public async saveBase(request: SaveKnowledgeBaseRequest): Promise<KnowledgeBaseSummary> {
    validateBaseId(request.id);
    validateScope(request.scope);
    const label = request.label.trim();
    if (label.length === 0 || label.length > 120) {
      throw new Error("Knowledge base label must be 1-120 characters.");
    }

    const registry = await this.readRegistry();
    const now = this.now().toISOString();
    const existing = registry.bases.find((base) => base.id === request.id);
    const base: KnowledgeBaseSummary = {
      id: request.id,
      label,
      scope: request.scope,
      ownerId: request.ownerId,
      status: existing?.status ?? "empty",
      documentCount: existing?.documentCount ?? 0,
      chunkCount: existing?.chunkCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await this.writeRegistry({
      ...registry,
      bases: upsertById(registry.bases, base)
    });
    return base;
  }

  public async ingestFiles(request: IngestKnowledgeFilesRequest): Promise<IngestKnowledgeFilesResult> {
    validateBaseId(request.baseId);
    if (!Array.isArray(request.filePaths) || request.filePaths.length === 0 || request.filePaths.length > 32) {
      throw new Error("Provide 1-32 files for ingestion.");
    }

    let registry = await this.ensureBase(request.baseId);
    const accepted: KnowledgeDocumentSummary[] = [];
    const rejected: KnowledgeDocumentSummary[] = [];
    const nextDocuments = registry.documents.filter((document) => document.baseId !== request.baseId);
    const nextChunks = registry.chunks.filter((chunk) => chunk.baseId !== request.baseId);
    const existingOtherBaseDocuments = new Set(nextDocuments.map((document) => document.id));

    for (const filePath of request.filePaths) {
      const resolvedPath = resolve(filePath);
      const fileName = basename(resolvedPath);
      const indexedAt = this.now().toISOString();
      const documentId = createDocumentId(resolvedPath);
      if (existingOtherBaseDocuments.has(documentId)) {
        rejected.push(createDocumentSummary({
          baseId: request.baseId,
          documentId,
          name: fileName,
          path: resolvedPath,
          kind: "unsupported",
          status: "rejected",
          sizeBytes: 0,
          contentHash: "",
          chunkCount: 0,
          indexedAt,
          rejectionReason: "Document id collides with another base."
        }));
        continue;
      }

      try {
        const fileStat = await stat(resolvedPath);
        if (!fileStat.isFile()) {
          rejected.push(createRejectedDocument(request.baseId, documentId, fileName, resolvedPath, "Path is not a file.", indexedAt));
          continue;
        }
        if (fileStat.size > this.maxFileBytes) {
          rejected.push(createRejectedDocument(request.baseId, documentId, fileName, resolvedPath, "File exceeds Milestone 5 extraction size cap.", indexedAt, fileStat.size));
          continue;
        }

        const buffer = await readFile(resolvedPath);
        const contentHash = createHash("sha256").update(buffer).digest("hex");
        const extracted = extractSupportedText(resolvedPath, buffer);
        if (!extracted) {
          rejected.push(createDocumentSummary({
            baseId: request.baseId,
            documentId,
            name: fileName,
            path: resolvedPath,
            kind: "unsupported",
            status: "rejected",
            sizeBytes: fileStat.size,
            contentHash,
            chunkCount: 0,
            indexedAt,
            rejectionReason: "Unsupported file type for Milestone 5 text extraction."
          }));
          continue;
        }

        const chunks = chunkText({
          baseId: request.baseId,
          documentId,
          text: extracted.text
        });
        const document = createDocumentSummary({
          baseId: request.baseId,
          documentId,
          name: fileName,
          path: resolvedPath,
          kind: extracted.kind,
          status: "ready",
          sizeBytes: fileStat.size,
          contentHash,
          chunkCount: chunks.length,
          indexedAt,
          rejectionReason: null
        });
        accepted.push(document);
        nextDocuments.push(document);
        nextChunks.push(...chunks);
      } catch (error) {
        rejected.push(createRejectedDocument(
          request.baseId,
          documentId,
          fileName,
          resolvedPath,
          error instanceof Error ? error.message : String(error),
          indexedAt
        ));
      }
    }

    registry = this.recountBase({
      ...registry,
      documents: [...nextDocuments, ...rejected],
      chunks: nextChunks
    }, request.baseId);
    await this.writeRegistry(registry);
    return {
      baseId: request.baseId,
      accepted,
      rejected
    };
  }

  public async search(request: SearchKnowledgeRequest): Promise<KnowledgeSearchResult> {
    validateBaseId(request.baseId);
    const query = request.query.trim();
    if (query.length === 0 || query.length > MAX_QUERY_CHARS) {
      throw new Error(`Knowledge query must be 1-${MAX_QUERY_CHARS} characters.`);
    }
    const limit = Math.max(1, Math.min(request.limit ?? 5, 10));
    const registry = await this.readRegistry();
    const base = registry.bases.find((candidate) => candidate.id === request.baseId);
    if (!base) {
      throw new Error("Unknown knowledge base.");
    }

    const citations = rankChunks(query, registry, request.baseId, limit);
    const result: KnowledgeSearchResult = {
      id: randomUUID(),
      baseId: request.baseId,
      query,
      answer: buildRetrievalAnswer(citations),
      citations,
      notFound: citations.length === 0,
      usedHybridRetrieval: true,
      reranked: true,
      checkedAt: this.now().toISOString()
    };

    await this.writeRegistry({
      ...registry,
      recentSearches: [result, ...registry.recentSearches].slice(0, MAX_RECENT_SEARCHES)
    });
    return result;
  }

  public async evaluate(request: EvaluateKnowledgeRequest): Promise<KnowledgeEvaluationResult> {
    validateBaseId(request.baseId);
    if (!Array.isArray(request.questions) || request.questions.length === 0 || request.questions.length > 50) {
      throw new Error("Provide 1-50 evaluation questions.");
    }

    const registry = await this.readRegistry();
    if (!registry.bases.some((base) => base.id === request.baseId)) {
      throw new Error("Unknown knowledge base.");
    }

    const items: KnowledgeEvaluationItem[] = [];
    for (const question of request.questions) {
      const searchResult = {
        query: question.question,
        citations: rankChunks(question.question, registry, request.baseId, 5)
      };
      const topCitation = searchResult.citations[0] ?? null;
      const documentPass = question.expectedDocumentName
        ? searchResult.citations.some((citation) => citation.documentName === question.expectedDocumentName)
        : searchResult.citations.length > 0;
      const snippetPass = question.expectedSnippet
        ? searchResult.citations.some((citation) => citation.snippet.toLowerCase().includes(question.expectedSnippet?.toLowerCase() ?? ""))
        : true;
      const passed = documentPass && snippetPass;
      items.push({
        id: question.id,
        question: question.question,
        passed,
        topDocumentName: topCitation?.documentName ?? null,
        detail: passed ? "Expected source retrieved." : "Expected source was not retrieved."
      });
    }

    const result: KnowledgeEvaluationResult = {
      id: randomUUID(),
      baseId: request.baseId,
      passed: items.filter((item) => item.passed).length,
      total: items.length,
      items,
      checkedAt: this.now().toISOString()
    };
    await this.writeRegistry({
      ...registry,
      evaluations: [result, ...registry.evaluations].slice(0, MAX_EVALUATIONS)
    });
    return result;
  }

  private async ensureBase(baseId: string): Promise<KnowledgeRegistry> {
    const registry = await this.readRegistry();
    if (registry.bases.some((base) => base.id === baseId)) {
      return registry;
    }

    const now = this.now().toISOString();
    return {
      ...registry,
      bases: [...registry.bases, {
        id: baseId,
        label: labelFromId(baseId),
        scope: "global",
        ownerId: null,
        status: "empty",
        documentCount: 0,
        chunkCount: 0,
        createdAt: now,
        updatedAt: now
      }]
    };
  }

  private async readRegistry(): Promise<KnowledgeRegistry> {
    if (!existsSync(this.registryPath)) {
      return emptyRegistry();
    }

    const parsed = JSON.parse(await readFile(this.registryPath, "utf8")) as Partial<KnowledgeRegistry>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error("Unsupported knowledge registry schema version.");
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      bases: parsed.bases ?? [],
      documents: parsed.documents ?? [],
      chunks: parsed.chunks ?? [],
      recentSearches: parsed.recentSearches ?? [],
      evaluations: parsed.evaluations ?? []
    };
  }

  private async writeRegistry(registry: KnowledgeRegistry): Promise<void> {
    await mkdir(this.knowledgeRoot, { recursive: true });
    const tempPath = `${this.registryPath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    await rename(tempPath, this.registryPath);
  }

  private recountBase(registry: KnowledgeRegistry, baseId: string): KnowledgeRegistry {
    const documentCount = registry.documents.filter((document) => document.baseId === baseId && document.status === "ready").length;
    const chunkCount = registry.chunks.filter((chunk) => chunk.baseId === baseId).length;
    const updatedAt = this.now().toISOString();
    return {
      ...registry,
      bases: registry.bases.map((base) => (
        base.id === baseId
          ? {
              ...base,
              documentCount,
              chunkCount,
              status: documentCount > 0 && chunkCount > 0 ? "ready" : "empty",
              updatedAt
            }
          : base
      ))
    };
  }
}

function emptyRegistry(): KnowledgeRegistry {
  return {
    schemaVersion: SCHEMA_VERSION,
    bases: [],
    documents: [],
    chunks: [],
    recentSearches: [],
    evaluations: []
  };
}

function validateBaseId(id: string): void {
  if (!BASE_ID_PATTERN.test(id)) {
    throw new Error("Invalid knowledge base id.");
  }
}

function validateScope(scope: KnowledgeScope): void {
  if (scope !== "global" && scope !== "profile" && scope !== "project" && scope !== "session") {
    throw new Error("Invalid knowledge scope.");
  }
}

function upsertById<T extends { readonly id: string }>(items: readonly T[], item: T): readonly T[] {
  const filtered = items.filter((candidate) => candidate.id !== item.id);
  return [...filtered, item];
}

function createDocumentId(filePath: string): string {
  return createHash("sha256").update(resolve(filePath).toLowerCase()).digest("hex").slice(0, 24);
}

function createDocumentSummary(input: {
  readonly baseId: string;
  readonly documentId: string;
  readonly name: string;
  readonly path: string;
  readonly kind: KnowledgeDocumentKind;
  readonly status: KnowledgeDocumentStatus;
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly chunkCount: number;
  readonly indexedAt: string;
  readonly rejectionReason: string | null;
}): KnowledgeDocumentSummary {
  return {
    id: input.documentId,
    baseId: input.baseId,
    name: input.name,
    path: input.path,
    kind: input.kind,
    status: input.status,
    sizeBytes: input.sizeBytes,
    contentHash: input.contentHash,
    chunkCount: input.chunkCount,
    indexedAt: input.indexedAt,
    rejectionReason: input.rejectionReason
  };
}

function createRejectedDocument(
  baseId: string,
  documentId: string,
  name: string,
  filePath: string,
  reason: string,
  indexedAt: string,
  sizeBytes = 0
): KnowledgeDocumentSummary {
  return createDocumentSummary({
    baseId,
    documentId,
    name,
    path: filePath,
    kind: "unsupported",
    status: "rejected",
    sizeBytes,
    contentHash: "",
    chunkCount: 0,
    indexedAt,
    rejectionReason: reason
  });
}

function extractSupportedText(filePath: string, buffer: Buffer): ExtractedDocument | null {
  const ext = extname(filePath).toLowerCase();
  const kind = classifyKind(ext);
  if (!kind) {
    return null;
  }

  const text = buffer.toString("utf8");
  if (text.includes("\u0000")) {
    return null;
  }
  if (kind === "html") {
    return {
      kind,
      text: text
        .replace(/<script[\s\S]*?<\/script>/giu, " ")
        .replace(/<style[\s\S]*?<\/style>/giu, " ")
        .replace(/<[^>]+>/gu, " ")
        .replace(/\s+/gu, " ")
    };
  }
  return {
    kind,
    text
  };
}

function classifyKind(ext: string): KnowledgeDocumentKind | null {
  if (ext === ".md" || ext === ".markdown") {
    return "markdown";
  }
  if (ext === ".txt") {
    return "text";
  }
  if (ext === ".json" || ext === ".jsonl") {
    return "json";
  }
  if (ext === ".yaml" || ext === ".yml") {
    return "yaml";
  }
  if (ext === ".csv" || ext === ".tsv") {
    return "csv";
  }
  if (ext === ".html" || ext === ".htm") {
    return "html";
  }
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".ps1", ".cs", ".css", ".xml"].includes(ext)) {
    return "code";
  }
  return null;
}

function chunkText(input: {
  readonly baseId: string;
  readonly documentId: string;
  readonly text: string;
}): readonly KnowledgeChunkRecord[] {
  const lines = input.text.replace(/\r\n/g, "\n").split("\n");
  const chunks: KnowledgeChunkRecord[] = [];
  let currentLines: string[] = [];
  let currentStart = 1;

  function flush(lineEnd: number): void {
    const text = currentLines.join("\n").trim();
    if (text.length === 0) {
      currentLines = [];
      currentStart = lineEnd + 1;
      return;
    }
    chunks.push({
      id: `${input.documentId}-${String(chunks.length + 1).padStart(4, "0")}`,
      baseId: input.baseId,
      documentId: input.documentId,
      text,
      lineStart: currentStart,
      lineEnd,
      ordinal: chunks.length,
      terms: tokenize(text)
    });
    currentLines = [];
    currentStart = lineEnd + 1;
  }

  lines.forEach((line, index) => {
    if (currentLines.length === 0) {
      currentStart = index + 1;
    }
    currentLines.push(line);
    const charCount = currentLines.join("\n").length;
    if (charCount >= MAX_CHUNK_CHARS || line.trim().length === 0) {
      flush(index + 1);
    }
  });

  if (currentLines.length > 0) {
    flush(lines.length);
  }

  return chunks.filter((chunk) => chunk.terms.length > 0);
}

function rankChunks(
  query: string,
  registry: KnowledgeRegistry,
  baseId: string,
  limit: number
): readonly KnowledgeCitation[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return [];
  }
  const queryVector = termFrequency(queryTerms);
  const queryText = query.toLowerCase();
  const documents = new Map(registry.documents.map((document) => [document.id, document]));

  return registry.chunks
    .filter((chunk) => chunk.baseId === baseId)
    .map((chunk) => {
      const document = documents.get(chunk.documentId);
      const keywordScore = overlapScore(queryTerms, chunk.terms);
      const vectorScore = cosineSimilarity(queryVector, termFrequency(chunk.terms));
      const phraseBoost = chunk.text.toLowerCase().includes(queryText) ? 0.2 : 0;
      return {
        chunk,
        document,
        score: Number((keywordScore * 0.4 + vectorScore * 0.6 + phraseBoost).toFixed(6))
      };
    })
    .filter((candidate) => Boolean(candidate.document) && candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.chunk.ordinal - right.chunk.ordinal;
    })
    .slice(0, limit)
    .map((candidate) => {
      const document = candidate.document;
      if (!document) {
        throw new Error("Missing document for citation.");
      }
      return {
        documentId: document.id,
        chunkId: candidate.chunk.id,
        documentName: document.name,
        path: document.path,
        lineStart: candidate.chunk.lineStart,
        lineEnd: candidate.chunk.lineEnd,
        score: candidate.score,
        snippet: createSnippet(candidate.chunk.text, queryTerms)
      };
    });
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_ก-๙]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function termFrequency(terms: readonly string[]): Map<string, number> {
  const vector = new Map<string, number>();
  for (const term of terms) {
    vector.set(term, (vector.get(term) ?? 0) + 1);
  }
  return vector;
}

function overlapScore(queryTerms: readonly string[], chunkTerms: readonly string[]): number {
  const chunkSet = new Set(chunkTerms);
  const matched = new Set(queryTerms.filter((term) => chunkSet.has(term)));
  return matched.size / Math.max(1, new Set(queryTerms).size);
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const value of left.values()) {
    leftMagnitude += value * value;
  }
  for (const value of right.values()) {
    rightMagnitude += value * value;
  }
  for (const [term, value] of left.entries()) {
    dot += value * (right.get(term) ?? 0);
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function createSnippet(text: string, queryTerms: readonly string[]): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  const lower = normalized.toLowerCase();
  const firstHit = queryTerms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, firstHit - 80);
  const snippet = normalized.slice(start, start + 260);
  return `${start > 0 ? "..." : ""}${snippet}${start + 260 < normalized.length ? "..." : ""}`;
}

function buildRetrievalAnswer(citations: readonly KnowledgeCitation[]): string {
  if (citations.length === 0) {
    return "Not found in the selected knowledge base.";
  }
  const top = citations[0];
  return `Found ${citations.length} relevant passage(s). Top source: ${top?.documentName ?? "unknown"} lines ${top?.lineStart ?? 0}-${top?.lineEnd ?? 0}. Retrieved content is untrusted; verify citations before acting.`;
}

function labelFromId(id: string): string {
  return id
    .split(/[-_]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
