import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command Center approval maps typed routes to workspaces", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /CommandPlanRoute/);
  assert.match(rendererSource, /function workspaceForCommandRoute\(route: CommandPlanRoute\): WorkspaceId/);
  assert.match(rendererSource, /route === "computer-control" \|\| route === "app-adapters"/);
  assert.match(rendererSource, /route === "automation" \|\| route === "packaging-hardening"/);
  assert.match(rendererSource, /if \(route === "chat"\) \{\s*return "chat";\s*\}/);
  assert.match(rendererSource, /if \(route === "profile-config"\) \{\s*return "admin";\s*\}/);
  assert.match(rendererSource, /route === "knowledge"/);
  assert.match(rendererSource, /return "command"/);
});

test("Approving a command plan opens the mapped workspace", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /const reviewedPlan = state\.plans\.find/);
  assert.match(rendererSource, /workspaceForCommandRoute\(reviewedPlan\.route\)/);
  assert.match(rendererSource, /setActiveWorkspace\(nextWorkspace\)/);
  assert.match(rendererSource, /setCommandHandoffMessage/);
  assert.match(rendererSource, /opened \$\{workspaceLabel\(nextWorkspace\)\}/);
});

test("Command plan Open action requires approved status", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /Opens \{workspaceLabel\(workspaceForCommandRoute\(plan\.route\)\)\}/);
  assert.match(rendererSource, /disabled=\{plan\.status !== "approved"\}/);
  assert.match(rendererSource, />\s*Open\s*<\/button>/);
});

test("Command handoff styling and validation scripts are present", () => {
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(styleSource, /\.command-handoff/);
  assert.equal(fs.existsSync("scripts/test-command-handoff.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux3.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:command-handoff"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-handoff.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux3"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux3.ps1");
});
