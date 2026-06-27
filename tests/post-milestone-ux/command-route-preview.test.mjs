import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command composer defines a typed route preview", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandComposerRouteConfidence = "empty" \| "matched" \| "manual"/);
  assert.match(rendererSource, /type CommandComposerRoutePreview/);
  assert.match(rendererSource, /readonly route: CommandPlanRoute/);
  assert.match(rendererSource, /readonly workspace: WorkspaceId/);
  assert.match(rendererSource, /readonly risk: CommandPlan\["risk"\]/);
  assert.match(rendererSource, /function buildCommandComposerRoutePreview\(\s*command: string,\s*blockedTerms: readonly string\[\]\s*\): CommandComposerRoutePreview/);
});

test("Command route preview covers local deterministic routes", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /route: "profile-config"/);
  assert.match(rendererSource, /intentLabel: "Backup"/);
  assert.match(rendererSource, /route: "automation"/);
  assert.match(rendererSource, /intentLabel: "Automation"/);
  assert.match(rendererSource, /route: "knowledge"/);
  assert.match(rendererSource, /intentLabel: "Knowledge"/);
  assert.match(rendererSource, /route: "packaging-hardening"/);
  assert.match(rendererSource, /intentLabel: "Packaging"/);
  assert.match(rendererSource, /route: "app-adapters"/);
  assert.match(rendererSource, /intentLabel: "App adapter"/);
  assert.match(rendererSource, /route: "computer-control"/);
  assert.match(rendererSource, /intentLabel: "Computer control"/);
  assert.match(rendererSource, /route: "chat"/);
  assert.match(rendererSource, /intentLabel: "Chat"/);
  assert.match(rendererSource, /confidence: "manual"/);
});

test("Command route preview renders after composer brief", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /commandComposerRoutePreview = buildCommandComposerRoutePreview\(commandText, blockedCommandTerms\)/);
  assert.match(rendererSource, /aria-label="Command route preview"/);
  assert.match(rendererSource, /command-route-preview \$\{commandComposerRoutePreview\.confidence\} risk-\$\{commandComposerRoutePreview\.risk\}/);
  assert.match(rendererSource, /workspaceLabel\(commandComposerRoutePreview\.workspace\)/);
  assert.ok(rendererSource.indexOf('aria-label="Command composer brief"') < rendererSource.indexOf('aria-label="Command route preview"'));
  assert.ok(rendererSource.indexOf('aria-label="Command route preview"') < rendererSource.indexOf('aria-label="Command presets"'));
  assert.match(styleSource, /\.command-route-preview/);
  assert.match(styleSource, /\.command-route-preview\.empty/);
  assert.match(styleSource, /\.command-route-preview\.manual/);
  assert.match(styleSource, /\.command-route-preview\.risk-medium/);
  assert.match(styleSource, /\.command-route-preview\.risk-high/);
});

test("Command route preview preserves approval isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const functionStart = rendererSource.indexOf("function buildCommandComposerRoutePreview");
  const functionEnd = rendererSource.indexOf("function pluralize", functionStart);
  const functionBlock = rendererSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(functionBlock, /createCommandPlan\(/);
  assert.doesNotMatch(functionBlock, /reviewCommandPlan\(/);
  assert.match(preloadSource, /createCommandPlan/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-route-preview.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux17.ps1"), true);
  assert.equal(pkg.scripts["test:command-route-preview"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-route-preview.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux17"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux17.ps1");
});
