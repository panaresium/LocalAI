import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines typed suggestions", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandComposerSuggestionTone = "info" \| "warning" \| "success"/);
  assert.match(rendererSource, /type CommandComposerSuggestion/);
  assert.match(rendererSource, /readonly id: "outcome" \| "target" \| "route" \| "safety" \| "length" \| "approval" \| "plan"/);
  assert.match(rendererSource, /readonly detail: string/);
  assert.match(
    rendererSource,
    /function buildCommandComposerSuggestions\(\s*command: string,\s*routePreview: CommandComposerRoutePreview,\s*blockedTerms: readonly string\[\],\s*maxChars: number,\s*requiresApproval: boolean,\s*readiness: CommandReadinessMeter\s*\): readonly CommandComposerSuggestion\[\]/
  );
});

test("Command composer suggestions cover empty, blocked, policy, detail, route, and ready states", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const suggestions: CommandComposerSuggestion\[\] = \[\]/);
  assert.match(rendererSource, /label: "Describe outcome"/);
  assert.match(rendererSource, /label: "Name a target"/);
  assert.match(rendererSource, /label: "Shorten command"/);
  assert.match(rendererSource, /label: "Revise blocked terms"/);
  assert.match(rendererSource, /label: "Restore approval"/);
  assert.match(rendererSource, /label: "Add target detail"/);
  assert.match(rendererSource, /label: "Clarify route"/);
  assert.match(rendererSource, /label: "Make Plan"/);
  assert.match(rendererSource, /if \(suggestions\.length === 0 && readiness\.tone === "ready"\)/);
  assert.match(rendererSource, /return suggestions\.slice\(0, 3\)/);
});

test("Command composer suggestions render before route preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  const summaryIndex = rendererSource.indexOf('aria-label="Command draft summary"');
  const suggestionsIndex = rendererSource.indexOf('aria-label="Command composer suggestions"');
  const routeIndex = rendererSource.indexOf('aria-label="Command route preview"');
  assert.match(rendererSource, /const commandComposerSuggestions = buildCommandComposerSuggestions\(/);
  assert.match(rendererSource, /aria-label="Command composer suggestions"/);
  assert.match(rendererSource, /commandComposerSuggestions\.map\(\(suggestion\) =>/);
  assert.ok(summaryIndex >= 0 && suggestionsIndex > summaryIndex);
  assert.ok(routeIndex > suggestionsIndex);
  assert.match(styleSource, /\.command-composer-suggestions/);
  assert.match(styleSource, /\.command-composer-suggestions li\.warning/);
  assert.match(styleSource, /\.command-composer-suggestions li\.success/);
});

test("Command composer suggestions remain local and package scripts are registered", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandComposerSuggestions");
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
  assert.equal(fs.existsSync("scripts/test-command-composer-suggestions.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux24.ps1"), true);
  assert.equal(pkg.scripts["test:command-composer-suggestions"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-composer-suggestions.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux24"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux24.ps1");
});
