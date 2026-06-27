import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("Studio header defines a typed active workspace summary", () => {
  assert.match(rendererSource, /type WorkspaceHeaderSummary = \{/);
  assert.match(rendererSource, /readonly label: string/);
  assert.match(rendererSource, /readonly detail: string/);
  assert.match(rendererSource, /readonly countLabel: string/);
  assert.match(rendererSource, /const WORKSPACE_HEADER_DETAILS: Record<WorkspaceId, string> = \{/);
  assert.match(
    rendererSource,
    /function buildWorkspaceHeaderSummary\(\s*workspaceId: WorkspaceId,\s*badges: Record<WorkspaceId, number>\s*\): WorkspaceHeaderSummary/
  );
});

test("Studio header summary covers every workspace with concise user-facing context", () => {
  for (const id of ["command", "control", "knowledge", "creation", "automation", "admin", "services"]) {
    assert.match(rendererSource, new RegExp(`${id}: "`));
  }
  assert.match(rendererSource, /command: "Command-first planning with explicit approval\."/);
  assert.match(rendererSource, /control: "Observe, propose, approve, and verify computer actions\."/);
  assert.match(rendererSource, /services: "Local service health, logs, and supervisor state\."/);
  assert.match(rendererSource, /countLabel: `\$\{count\} \$\{count === 1 \? "item" : "items"\}`/);
});

test("Studio header renders active workspace context instead of stale milestone copy", () => {
  assert.match(rendererSource, /const workspaceHeaderSummary = buildWorkspaceHeaderSummary\(activeWorkspace, workspaceBadges\)/);
  assert.match(rendererSource, /className="topbar-title"/);
  assert.match(rendererSource, /\{workspaceHeaderSummary\.detail\}/);
  assert.match(rendererSource, /className="topbar-context" aria-label="Active workspace summary"/);
  assert.match(rendererSource, /\{workspaceHeaderSummary\.label\}/);
  assert.match(rendererSource, /\{workspaceHeaderSummary\.countLabel\}/);
  assert.doesNotMatch(rendererSource, /<p>Milestone 16 Packaging and Hardening<\/p>/);
});

test("Studio header context styling stays compact and responsive", () => {
  assert.match(styleSource, /\.topbar-title/);
  assert.match(styleSource, /\.topbar-context \{/);
  assert.match(styleSource, /min-width: 138px/);
  assert.match(styleSource, /border-radius: 6px/);
  assert.match(styleSource, /text-overflow: ellipsis/);
  assert.match(styleSource, /white-space: nowrap/);
});

test("Studio header context remains display-only and package scripts are registered", () => {
  const helperStart = rendererSource.indexOf("function buildWorkspaceHeaderSummary");
  const helperEnd = rendererSource.indexOf("function commandContainsBlockedTerm", helperStart);
  const helperBlock = helperStart >= 0 && helperEnd > helperStart ? rendererSource.slice(helperStart, helperEnd) : "";

  assert.doesNotMatch(helperBlock, /createCommandPlan\(/);
  assert.doesNotMatch(helperBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(helperBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.equal(fs.existsSync("scripts/test-studio-header-context.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux36.ps1"), true);
  assert.equal(pkg.scripts["test:studio-header-context"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-studio-header-context.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux36"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux36.ps1");
});
