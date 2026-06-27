import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspaceIds = ["command", "control", "knowledge", "creation", "automation", "admin", "services"];

test("Studio renderer defines typed workspace navigation", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type WorkspaceId/);
  assert.match(rendererSource, /const WORKSPACES/);
  assert.match(rendererSource, /useState<WorkspaceId>\("command"\)/);
  assert.match(rendererSource, /workspaceBadges: Record<WorkspaceId, number>/);
  assert.match(rendererSource, /workspace-\$\{activeWorkspace\}/);
  assert.match(rendererSource, /className="workspace-nav"/);
  assert.match(rendererSource, /aria-current/);
  assert.match(rendererSource, /setActiveWorkspace\(workspace\.id\)/);
  for (const id of workspaceIds) {
    assert.match(rendererSource, new RegExp(`id: "${id}"`));
  }
});

test("Workspace grouping CSS hides inactive modules", () => {
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(styleSource, /\.workspace-nav/);
  assert.match(styleSource, /\.workspace-nav button\.active/);
  assert.match(styleSource, /\.studio-shell\.workspace-command/);
  assert.match(styleSource, /\.studio-shell\.workspace-services/);
  assert.match(styleSource, /display:\s*none/);
  for (const id of workspaceIds) {
    assert.match(styleSource, new RegExp(`workspace-${id}`));
  }
});

test("Workspace navigation keeps renderer isolated and Command Center present", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /command-workspace/);
  assert.match(rendererSource, /Command Center/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
});

test("Workspace navigation validation scripts are present", () => {
  assert.equal(fs.existsSync("scripts/test-workspace-navigation.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux2.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:workspace-navigation"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-workspace-navigation.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux2"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux2.ps1");
});
