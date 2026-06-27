import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type {
  LearningAuditEvent,
  LearningCandidateStatus,
  LearningMemoryCandidate,
  LearningMemoryItem,
  LearningProvenance,
  LearningReviewDecision,
  LearningScope,
  LearningSkillCandidate,
  LearningSkillItem,
  LearningSkillVersion,
  LearningSourceKind,
  LearningState,
  ProposeMemoryCandidateRequest,
  ProposeSkillCandidateRequest,
  ReviewMemoryCandidateRequest,
  ReviewSkillCandidateRequest,
  RollbackSkillVersionRequest
} from "@hermes-local-ai/contracts";

interface LearningRegistry extends LearningState {
  readonly schemaVersion: 1;
}

export interface LearningManagerOptions {
  readonly now?: () => Date;
}

const SCHEMA_VERSION = 1;
const MAX_MEMORY_CHARS = 4000;
const MAX_SKILL_BODY_CHARS = 16000;
const MAX_AUDIT_EVENTS = 200;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/u,
  /(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/iu,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/u
];

export class LearningManager {
  private readonly root: string;
  private readonly learningRoot: string;
  private readonly registryPath: string;
  private readonly now: () => Date;

  public constructor(root: string, options: LearningManagerOptions = {}) {
    this.root = resolve(root);
    this.learningRoot = join(this.root, "learning");
    this.registryPath = join(this.learningRoot, "learning-registry.json");
    this.now = options.now ?? (() => new Date());
  }

  public async getState(): Promise<LearningState> {
    const registry = await this.readRegistry();
    return {
      memoryCandidates: registry.memoryCandidates,
      memoryItems: registry.memoryItems,
      skillCandidates: registry.skillCandidates,
      skills: registry.skills,
      audit: registry.audit
    };
  }

  public async proposeMemory(request: ProposeMemoryCandidateRequest): Promise<LearningMemoryCandidate> {
    validateScope(request.scope);
    validateConfidence(request.confidence);
    const content = sanitizeContent(request.content, MAX_MEMORY_CHARS);
    assertNoSecrets(content);
    const now = this.now().toISOString();
    const candidate: LearningMemoryCandidate = {
      id: randomUUID(),
      scope: request.scope,
      content,
      confidence: request.confidence,
      status: "pending",
      provenance: withCreatedAt(request.provenance, now),
      reviewedAt: null,
      reviewNote: null
    };
    const registry = await this.readRegistry();
    await this.writeRegistry({
      ...registry,
      memoryCandidates: [candidate, ...registry.memoryCandidates],
      audit: pushAudit(registry.audit, createAudit("memory.proposed", candidate.id, "Memory candidate proposed.", now))
    });
    return candidate;
  }

  public async reviewMemory(request: ReviewMemoryCandidateRequest): Promise<LearningState> {
    validateReviewDecision(request.decision);
    const registry = await this.readRegistry();
    const candidate = registry.memoryCandidates.find((item) => item.id === request.candidateId);
    if (!candidate) {
      throw new Error("Unknown memory candidate.");
    }
    if (candidate.status !== "pending") {
      throw new Error("Memory candidate has already been reviewed.");
    }

    const now = this.now().toISOString();
    const reviewedCandidate: LearningMemoryCandidate = {
      ...candidate,
      content: request.editedContent === undefined ? candidate.content : sanitizeContent(request.editedContent, MAX_MEMORY_CHARS),
      status: request.decision === "approve" ? "approved" : "rejected",
      reviewedAt: now,
      reviewNote: request.reviewNote ?? null
    };
    assertNoSecrets(reviewedCandidate.content);

    let memoryItems = registry.memoryItems;
    let event: LearningAuditEvent;
    if (request.decision === "approve") {
      const memoryItem: LearningMemoryItem = {
        id: randomUUID(),
        scope: reviewedCandidate.scope,
        content: reviewedCandidate.content,
        sourceCandidateId: reviewedCandidate.id,
        confidence: reviewedCandidate.confidence,
        createdAt: now,
        lastVerifiedAt: now,
        expiresAt: request.expiresAt ?? null,
        supersededBy: null,
        provenance: reviewedCandidate.provenance
      };
      memoryItems = [memoryItem, ...memoryItems];
      event = createAudit("memory.approved", memoryItem.id, `Approved candidate ${reviewedCandidate.id}.`, now);
    } else {
      event = createAudit("memory.rejected", reviewedCandidate.id, "Memory candidate rejected; no memory item created.", now);
    }

    await this.writeRegistry({
      ...registry,
      memoryCandidates: registry.memoryCandidates.map((item) => item.id === reviewedCandidate.id ? reviewedCandidate : item),
      memoryItems,
      audit: pushAudit(registry.audit, event)
    });
    return this.getState();
  }

  public async proposeSkill(request: ProposeSkillCandidateRequest): Promise<LearningSkillCandidate> {
    const name = sanitizeName(request.name);
    const summary = sanitizeContent(request.summary, 1000);
    const body = sanitizeContent(request.body, MAX_SKILL_BODY_CHARS);
    assertNoSecrets(`${summary}\n${body}`);
    const now = this.now().toISOString();
    const candidate: LearningSkillCandidate = {
      id: randomUUID(),
      name,
      summary,
      body,
      status: "pending",
      provenance: withCreatedAt(request.provenance, now),
      reviewedAt: null,
      reviewNote: null
    };
    const registry = await this.readRegistry();
    await this.writeRegistry({
      ...registry,
      skillCandidates: [candidate, ...registry.skillCandidates],
      audit: pushAudit(registry.audit, createAudit("skill.proposed", candidate.id, `Skill candidate proposed: ${candidate.name}.`, now))
    });
    return candidate;
  }

  public async reviewSkill(request: ReviewSkillCandidateRequest): Promise<LearningState> {
    validateReviewDecision(request.decision);
    const registry = await this.readRegistry();
    const candidate = registry.skillCandidates.find((item) => item.id === request.candidateId);
    if (!candidate) {
      throw new Error("Unknown skill candidate.");
    }
    if (candidate.status !== "pending") {
      throw new Error("Skill candidate has already been reviewed.");
    }

    const now = this.now().toISOString();
    const body = request.editedBody === undefined ? candidate.body : sanitizeContent(request.editedBody, MAX_SKILL_BODY_CHARS);
    const summary = request.editedSummary === undefined ? candidate.summary : sanitizeContent(request.editedSummary, 1000);
    assertNoSecrets(`${summary}\n${body}`);
    const reviewedCandidate: LearningSkillCandidate = {
      ...candidate,
      body,
      summary,
      status: request.decision === "approve" ? "approved" : "rejected",
      reviewedAt: now,
      reviewNote: request.reviewNote ?? null
    };

    let skills = registry.skills;
    let event: LearningAuditEvent;
    if (request.decision === "approve") {
      const skillId = skillIdFromName(reviewedCandidate.name);
      const existing = skills.find((skill) => skill.id === skillId);
      const versionNumber = existing ? Math.max(...existing.versions.map((version) => version.version)) + 1 : 1;
      const version: LearningSkillVersion = {
        version: versionNumber,
        body: reviewedCandidate.body,
        summary: reviewedCandidate.summary,
        sourceCandidateId: reviewedCandidate.id,
        createdAt: now,
        provenance: reviewedCandidate.provenance
      };
      const skill: LearningSkillItem = existing
        ? {
            ...existing,
            activeVersion: version.version,
            versions: [...existing.versions, version],
            updatedAt: now
          }
        : {
            id: skillId,
            name: reviewedCandidate.name,
            activeVersion: version.version,
            versions: [version],
            createdAt: now,
            updatedAt: now
          };
      skills = upsertById(skills, skill);
      event = createAudit("skill.approved", skill.id, `Approved candidate ${reviewedCandidate.id} as version ${version.version}.`, now);
    } else {
      event = createAudit("skill.rejected", reviewedCandidate.id, "Skill candidate rejected; no skill item created.", now);
    }

    await this.writeRegistry({
      ...registry,
      skillCandidates: registry.skillCandidates.map((item) => item.id === reviewedCandidate.id ? reviewedCandidate : item),
      skills,
      audit: pushAudit(registry.audit, event)
    });
    return this.getState();
  }

  public async rollbackSkill(request: RollbackSkillVersionRequest): Promise<LearningState> {
    const registry = await this.readRegistry();
    const skill = registry.skills.find((item) => item.id === request.skillId);
    if (!skill) {
      throw new Error("Unknown skill.");
    }
    if (!skill.versions.some((version) => version.version === request.version)) {
      throw new Error("Unknown skill version.");
    }

    const now = this.now().toISOString();
    const rolledBackSkill: LearningSkillItem = {
      ...skill,
      activeVersion: request.version,
      updatedAt: now
    };
    await this.writeRegistry({
      ...registry,
      skills: registry.skills.map((item) => item.id === skill.id ? rolledBackSkill : item),
      audit: pushAudit(registry.audit, createAudit(
        "skill.rollback",
        skill.id,
        request.reviewNote ?? `Rolled back to version ${request.version}.`,
        now
      ))
    });
    return this.getState();
  }

  private async readRegistry(): Promise<LearningRegistry> {
    if (!existsSync(this.registryPath)) {
      return emptyRegistry();
    }

    const parsed = JSON.parse(await readFile(this.registryPath, "utf8")) as Partial<LearningRegistry>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error("Unsupported learning registry schema version.");
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      memoryCandidates: parsed.memoryCandidates ?? [],
      memoryItems: parsed.memoryItems ?? [],
      skillCandidates: parsed.skillCandidates ?? [],
      skills: parsed.skills ?? [],
      audit: parsed.audit ?? []
    };
  }

  private async writeRegistry(registry: LearningRegistry): Promise<void> {
    await mkdir(this.learningRoot, { recursive: true });
    const tempPath = `${this.registryPath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    await rename(tempPath, this.registryPath);
  }
}

function emptyRegistry(): LearningRegistry {
  return {
    schemaVersion: SCHEMA_VERSION,
    memoryCandidates: [],
    memoryItems: [],
    skillCandidates: [],
    skills: [],
    audit: []
  };
}

function validateScope(value: LearningScope): void {
  if (value !== "user" && value !== "profile" && value !== "project" && value !== "session") {
    throw new Error("Invalid learning scope.");
  }
}

function validateSourceKind(value: LearningSourceKind): void {
  if (value !== "chat" && value !== "task" && value !== "manual" && value !== "knowledge" && value !== "workflow") {
    throw new Error("Invalid learning source kind.");
  }
}

function validateReviewDecision(value: LearningReviewDecision): void {
  if (value !== "approve" && value !== "reject") {
    throw new Error("Invalid review decision.");
  }
}

function validateConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Confidence must be between 0 and 1.");
  }
}

function withCreatedAt(provenance: Omit<LearningProvenance, "createdAt">, createdAt: string): LearningProvenance {
  validateSourceKind(provenance.sourceKind);
  return {
    sourceKind: provenance.sourceKind,
    sourceId: provenance.sourceId,
    profileId: provenance.profileId,
    projectId: provenance.projectId,
    note: sanitizeContent(provenance.note, 1000),
    createdAt
  };
}

function sanitizeContent(value: string, limit: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Content is required.");
  }
  if (trimmed.length > limit) {
    throw new Error(`Content exceeds ${limit} characters.`);
  }
  return trimmed;
}

function sanitizeName(value: string): string {
  const name = value.trim().replace(/\s+/gu, " ");
  if (name.length < 2 || name.length > 100) {
    throw new Error("Skill name must be 2-100 characters.");
  }
  return name;
}

function assertNoSecrets(content: string): void {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new Error("Learning content appears to contain a secret.");
  }
}

function createAudit(type: LearningAuditEvent["type"], targetId: string, detail: string, createdAt: string): LearningAuditEvent {
  return {
    id: randomUUID(),
    type,
    targetId,
    detail,
    createdAt
  };
}

function pushAudit(events: readonly LearningAuditEvent[], event: LearningAuditEvent): readonly LearningAuditEvent[] {
  return [event, ...events].slice(0, MAX_AUDIT_EVENTS);
}

function upsertById<T extends { readonly id: string }>(items: readonly T[], item: T): readonly T[] {
  const filtered = items.filter((candidate) => candidate.id !== item.id);
  return [...filtered, item];
}

function skillIdFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return slug || "skill";
}
