import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines typed revision drafts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandRevisionDraftSource = "review-note" \| "blockers" \| "reviewed-note" \| "default"/);
  assert.match(rendererSource, /type CommandRevisionDraft/);
  assert.match(rendererSource, /readonly sourcePlanId: string/);
  assert.match(rendererSource, /readonly ready: boolean/);
  assert.match(rendererSource, /function buildCommandRevisionDraft\(\s*plan: CommandPlan,\s*reviewNote: string,\s*maxChars: number\s*\): CommandRevisionDraft/);
});

test("Command revision draft uses review feedback before fallback sources", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const trimmedReviewNote = reviewNote\.trim\(\)/);
  assert.match(rendererSource, /const blockedFeedback = plan\.blockedReasons\.join\("; "\)/);
  assert.match(rendererSource, /const reviewedNote = plan\.reviewNote\?\.trim\(\) \?\? ""/);
  assert.match(rendererSource, /Original command: \$\{plan\.command\}\\nFeedback: \$\{feedback\}/);
  assert.match(rendererSource, /ready: source !== "default"/);
  assert.match(rendererSource, /function limitCommandDraft\(value: string, maxChars: number\): string/);
});

test("Command revision draft renders below the review note", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /selectedCommandRevisionDraft = selectedCommandPlan\s*\?\s*buildCommandRevisionDraft\(selectedCommandPlan, commandReviewNote, commandLengthLimit\)/);
  assert.match(rendererSource, /aria-label="Command revision draft"/);
  assert.match(rendererSource, /Use note for revision/);
  assert.ok(rendererSource.indexOf('className="text-field command-review-note"') < rendererSource.indexOf('aria-label="Command revision draft"'));
  assert.match(styleSource, /\.command-revision-draft/);
  assert.match(styleSource, /\.command-revision-draft\.ready/);
  assert.match(styleSource, /\.command-revision-draft\.idle/);
});

test("Command revision draft fills command text without creating or approving a plan", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function useCommandRevisionDraft");
  const functionEnd = rendererSource.indexOf("useEffect", functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.match(rendererSource, /function useCommandRevisionDraft\(plan: CommandPlan\): void/);
  assert.match(functionBlock, /setCommandText\(revisionDraft\.command\)/);
  assert.match(functionBlock, /Press Make Plan to review it/);
  assert.doesNotMatch(functionBlock, /window\.hermesStudio\.createCommandPlan/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.match(preloadSource, /createCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-revision-draft.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux15.ps1"), true);
  assert.equal(pkg.scripts["test:command-revision-draft"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-revision-draft.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux15"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux15.ps1");
});
