import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command review defines a typed note cue", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandReviewNoteCueTone = "idle" \| "ready" \| "blocked" \| "locked"/);
  assert.match(rendererSource, /type CommandReviewNoteCue/);
  assert.match(rendererSource, /readonly suggestion: string/);
  assert.match(rendererSource, /readonly guard: string/);
  assert.match(rendererSource, /readonly characterCount: number/);
  assert.match(
    rendererSource,
    /function buildCommandReviewNoteCue\(\s*plan: CommandPlan,\s*reviewNote: string\s*\): CommandReviewNoteCue/
  );
});

test("Command review note cue covers draft, blocked, approved, and rejected states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /label: "Review closed"/);
  assert.match(rendererSource, /guard: "Note locked"/);
  assert.match(rendererSource, /label: "Revision source"/);
  assert.match(rendererSource, /suggestion: "Use revision draft for feedback"/);
  assert.match(rendererSource, /label: trimmedReviewNote \? "Revision note ready" : "Add blocker feedback"/);
  assert.match(rendererSource, /guard: "Approve disabled"/);
  assert.match(rendererSource, /label: "Decision note ready"/);
  assert.match(rendererSource, /guard: "Handoff still approval-gated"/);
  assert.match(rendererSource, /label: "Optional note"/);
  assert.match(rendererSource, /guard: "No handoff before approval"/);
});

test("Command review note cue renders beside note entry before revision draft", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const noteIndex = rendererSource.indexOf('className="text-field command-review-note"');
  const cueIndex = rendererSource.indexOf('aria-label="Command review note cue"');
  const revisionIndex = rendererSource.indexOf('aria-label="Command revision draft"');
  assert.match(rendererSource, /const selectedCommandReviewNoteCue = selectedCommandPlan/);
  assert.match(rendererSource, /buildCommandReviewNoteCue\(selectedCommandPlan, commandReviewNote\)/);
  assert.match(rendererSource, /className=\{`command-review-note-cue \$\{selectedCommandReviewNoteCue\.tone\}`\}/);
  assert.match(rendererSource, /selectedCommandReviewNoteCue\.suggestion/);
  assert.match(rendererSource, /selectedCommandReviewNoteCue\.characterCount/);
  assert.ok(noteIndex >= 0 && cueIndex > noteIndex);
  assert.ok(revisionIndex > cueIndex);
  assert.match(styleSource, /\.command-review-note-cue/);
  assert.match(styleSource, /\.command-review-note-cue\.idle/);
  assert.match(styleSource, /\.command-review-note-cue\.ready/);
  assert.match(styleSource, /\.command-review-note-cue\.blocked/);
  assert.match(styleSource, /\.command-review-note-cue\.locked/);
});

test("Command review note cue remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandReviewNoteCue");
  const functionEnd = rendererSource.indexOf("function summarizeCommandDecision", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-review-note-cue.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux32.ps1"), true);
  assert.equal(pkg.scripts["test:command-review-note-cue"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-review-note-cue.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux32"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux32.ps1");
});
