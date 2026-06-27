import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed readiness meter", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandReadinessTone = "empty" \| "needs-detail" \| "blocked" \| "ready"/);
  assert.match(rendererSource, /type CommandReadinessMeter/);
  assert.match(rendererSource, /readonly score: number/);
  assert.match(rendererSource, /readonly nextStep: string/);
  assert.match(
    rendererSource,
    /function buildCommandReadinessMeter\(\s*command: string,\s*routePreview: CommandComposerRoutePreview,\s*blockedTerms: readonly string\[\],\s*maxChars: number,\s*requiresApproval: boolean\s*\): CommandReadinessMeter/
  );
});

test("Command readiness meter scores local command planning signals", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const trimmedCommand = command\.trim\(\)/);
  assert.match(rendererSource, /const wordCount = trimmedCommand \? trimmedCommand\.split\(\/\\s\+\/u\)\.length : 0/);
  assert.match(rendererSource, /const withinLimit = command\.length <= maxChars/);
  assert.match(rendererSource, /const hasTargetDetail = wordCount >= 4/);
  assert.match(rendererSource, /const hasMatchedRoute = routePreview\.confidence === "matched"/);
  assert.match(rendererSource, /const hasBlockers = blockedTerms\.length > 0/);
  assert.match(rendererSource, /const score = Math\.min\(100, Math\.max\(0,/);
  assert.match(rendererSource, /label: "Waiting"/);
  assert.match(rendererSource, /label: "Too long"/);
  assert.match(rendererSource, /label: "Review only"/);
  assert.match(rendererSource, /label: "Policy check"/);
  assert.match(rendererSource, /label: "Needs target"/);
  assert.match(rendererSource, /label: "Needs route"/);
  assert.match(rendererSource, /label: "Ready"/);
  assert.match(rendererSource, /nextStep: "Make Plan for approval"/);
});

test("Command readiness meter renders before the route preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const briefIndex = rendererSource.indexOf('aria-label="Command composer brief"');
  const meterIndex = rendererSource.indexOf('aria-label="Command readiness meter"');
  const routeIndex = rendererSource.indexOf('aria-label="Command route preview"');
  assert.match(rendererSource, /const commandReadinessMeter = buildCommandReadinessMeter\(/);
  assert.match(rendererSource, /aria-label="Command readiness meter"/);
  assert.match(rendererSource, /commandReadinessMeter\.score/);
  assert.match(rendererSource, /aria-label=\{`Readiness score \$\{commandReadinessMeter\.score\} percent`\}/);
  assert.ok(briefIndex >= 0 && meterIndex > briefIndex);
  assert.ok(routeIndex > meterIndex);
  assert.match(styleSource, /\.command-readiness-meter/);
  assert.match(styleSource, /\.command-readiness-meter\.ready/);
  assert.match(styleSource, /\.command-readiness-meter\.needs-detail/);
  assert.match(styleSource, /\.command-readiness-meter\.blocked/);
  assert.match(styleSource, /\.command-readiness-track/);
});

test("Command readiness meter remains display-only and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandReadinessMeter");
  const functionEnd = rendererSource.indexOf("function pluralize", functionStart);
  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /setActiveWorkspace\(/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-readiness-meter.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux22.ps1"), true);
  assert.equal(pkg.scripts["test:command-readiness-meter"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-readiness-meter.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux22"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux22.ps1");
});
