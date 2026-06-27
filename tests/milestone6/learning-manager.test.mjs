import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/learning-manager.js")).href;

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "studio-m6-"));
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
  return root;
}

function provenance(note = "test provenance") {
  return {
    sourceKind: "manual",
    sourceId: "test-source",
    profileId: "test-profile",
    projectId: "localai",
    note
  };
}

test("Milestone 6 migration plan exists before learning registry writes", async () => {
  assert.equal(existsSync("docs/milestone-6/memory-skills-learning-migration-plan.md"), true);
  const { LearningManager } = await import(managerModulePath);
  const root = await createWorkspace();
  const manager = new LearningManager(root);

  await manager.proposeMemory({
    scope: "project",
    content: "Use explicit validation before claiming milestone completion.",
    confidence: 0.8,
    provenance: provenance()
  });

  const registry = JSON.parse(await fs.readFile(path.join(root, "learning", "learning-registry.json"), "utf8"));
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.memoryCandidates.length, 1);
});

test("approved memory persists to a new manager session with provenance", async () => {
  const { LearningManager } = await import(managerModulePath);
  const root = await createWorkspace();
  const manager = new LearningManager(root);

  const candidate = await manager.proposeMemory({
    scope: "project",
    content: "Project prefers scripts with logs and validation evidence.",
    confidence: 0.9,
    provenance: provenance("memory approval test")
  });
  await manager.reviewMemory({
    candidateId: candidate.id,
    decision: "approve",
    reviewNote: "Approved by test."
  });

  const reloaded = new LearningManager(root);
  const state = await reloaded.getState();
  assert.equal(state.memoryItems.length, 1);
  assert.equal(state.memoryItems[0].sourceCandidateId, candidate.id);
  assert.equal(state.memoryItems[0].provenance.profileId, "test-profile");
  assert.equal(state.memoryCandidates[0].status, "approved");
});

test("rejected memory does not create an approved memory item", async () => {
  const { LearningManager } = await import(managerModulePath);
  const root = await createWorkspace();
  const manager = new LearningManager(root);

  const candidate = await manager.proposeMemory({
    scope: "user",
    content: "Temporary note that should not persist as memory.",
    confidence: 0.5,
    provenance: provenance("memory rejection test")
  });
  const state = await manager.reviewMemory({
    candidateId: candidate.id,
    decision: "reject",
    reviewNote: "Not durable."
  });

  assert.equal(state.memoryItems.length, 0);
  assert.equal(state.memoryCandidates[0].status, "rejected");
});

test("learning manager rejects obvious secrets", async () => {
  const { LearningManager } = await import(managerModulePath);
  const root = await createWorkspace();
  const manager = new LearningManager(root);

  await assert.rejects(
    () => manager.proposeMemory({
      scope: "user",
      content: `${["api", "key"].join("_")}=placeholder-value`,
      confidence: 0.9,
      provenance: provenance("secret test")
    }),
    /secret/
  );
});

test("skill approval creates versions and rollback changes only active version", async () => {
  const { LearningManager } = await import(managerModulePath);
  const root = await createWorkspace();
  const manager = new LearningManager(root);

  const first = await manager.proposeSkill({
    name: "Validate milestone evidence",
    summary: "Check build and runner evidence before status updates.",
    body: "steps:\n  - run milestone gate\n  - inspect run-summary.json",
    provenance: provenance("skill v1")
  });
  await manager.reviewSkill({
    candidateId: first.id,
    decision: "approve",
    reviewNote: "Approve v1."
  });

  const second = await manager.proposeSkill({
    name: "Validate milestone evidence",
    summary: "Check build, runner evidence, and status ledger before final response.",
    body: "steps:\n  - run milestone gate\n  - inspect run-summary.json\n  - update STATUS.md",
    provenance: provenance("skill v2")
  });
  let state = await manager.reviewSkill({
    candidateId: second.id,
    decision: "approve",
    reviewNote: "Approve v2."
  });

  const skill = state.skills.find((item) => item.id === "validate-milestone-evidence");
  assert.equal(skill.versions.length, 2);
  assert.equal(skill.activeVersion, 2);
  assert.equal(skill.versions.every((version) => version.provenance.sourceId === "test-source"), true);

  state = await manager.rollbackSkill({
    skillId: "validate-milestone-evidence",
    version: 1,
    reviewNote: "Rollback test."
  });
  const rolledBack = state.skills.find((item) => item.id === "validate-milestone-evidence");
  assert.equal(rolledBack.activeVersion, 1);
  assert.equal(rolledBack.versions.length, 2);
  assert.equal(state.audit.some((event) => event.type === "skill.rollback"), true);
});

test("rejected skill candidate does not create skill item", async () => {
  const { LearningManager } = await import(managerModulePath);
  const root = await createWorkspace();
  const manager = new LearningManager(root);

  const candidate = await manager.proposeSkill({
    name: "Do not keep",
    summary: "Rejected workflow.",
    body: "steps:\n  - do nothing",
    provenance: provenance("skill rejection")
  });
  const state = await manager.reviewSkill({
    candidateId: candidate.id,
    decision: "reject",
    reviewNote: "Not useful."
  });

  assert.equal(state.skills.length, 0);
  assert.equal(state.skillCandidates[0].status, "rejected");
});

test("preload exposes learning APIs without Node or shell access", () => {
  const preloadSource = existsSync("apps/studio-desktop/src/preload/preload.cts")
    ? readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8")
    : "";
  assert.match(preloadSource, /getLearningState/);
  assert.match(preloadSource, /proposeMemoryCandidate/);
  assert.match(preloadSource, /reviewSkillCandidate/);
  assert.match(preloadSource, /rollbackSkillVersion/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("process"/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("require"/);
  assert.doesNotMatch(preloadSource, /shell\./);
});
