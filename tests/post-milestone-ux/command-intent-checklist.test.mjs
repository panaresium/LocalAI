import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines typed intent checklist items", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandIntentCheckState = "pass" \| "hint" \| "blocked"/);
  assert.match(rendererSource, /type CommandIntentCheck/);
  assert.match(rendererSource, /readonly id: "intent" \| "target" \| "approval" \| "safety"/);
  assert.match(rendererSource, /function buildCommandIntentChecklist\(\s*command: string,\s*routePreview: CommandComposerRoutePreview,\s*blockedTerms: readonly string\[\],\s*requiresApproval: boolean\s*\): readonly CommandIntentCheck\[\]/);
});

test("Command intent checklist covers command clarity and safety gates", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /id: "intent"/);
  assert.match(rendererSource, /routePreview\.confidence === "matched"/);
  assert.match(rendererSource, /id: "target"/);
  assert.match(rendererSource, /wordCount >= 4/);
  assert.match(rendererSource, /id: "approval"/);
  assert.match(rendererSource, /requiresApproval \? "User approval required" : "Approval policy unavailable"/);
  assert.match(rendererSource, /id: "safety"/);
  assert.match(rendererSource, /blockedTerms\.length > 0 \? pluralize\(blockedTerms\.length, "blocked term", "blocked terms"\) : "No blocked terms"/);
});

test("Command intent checklist renders after route preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /commandIntentChecklist = buildCommandIntentChecklist\(/);
  assert.match(rendererSource, /aria-label="Command intent checklist"/);
  assert.match(rendererSource, /commandIntentChecklist\.map\(\(check\) =>/);
  assert.ok(rendererSource.indexOf('aria-label="Command route preview"') < rendererSource.indexOf('aria-label="Command intent checklist"'));
  assert.ok(rendererSource.indexOf('aria-label="Command intent checklist"') < rendererSource.indexOf('Blocked terms:'));
  assert.match(styleSource, /\.command-intent-checklist/);
  assert.match(styleSource, /\.command-intent-checklist li\.pass/);
  assert.match(styleSource, /\.command-intent-checklist li\.hint/);
  assert.match(styleSource, /\.command-intent-checklist li\.blocked/);
});

test("Command intent checklist preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandIntentChecklist");
  const functionEnd = rendererSource.indexOf("function pluralize", functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.match(preloadSource, /createCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-intent-checklist.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux18.ps1"), true);
  assert.equal(pkg.scripts["test:command-intent-checklist"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-intent-checklist.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux18"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux18.ps1");
});
