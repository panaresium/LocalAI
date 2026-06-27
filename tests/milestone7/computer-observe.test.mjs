import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/computer-observe-manager.js")).href;

test("Milestone 7 contracts add screenshot and highlight while preserving no-input policy", () => {
  const source = fs.readFileSync("packages/contracts/src/computer-actions.ts", "utf8");
  assert.match(source, /MILESTONE7_OBSERVE_ONLY_ACTIONS = \[/);
  assert.match(source, /"screen\.capture"/);
  assert.match(source, /"ui\.highlight"/);
  assert.match(source, /allowInput:\s*false/);
  assert.match(source, /allowDestructiveAction:\s*false/);
  assert.match(source, /allowElevation:\s*false/);

  const milestone7Block = source.slice(source.indexOf("MILESTONE7_OBSERVE_ONLY_ACTIONS"), source.indexOf("MILESTONE8_ACTIVE_ACTIONS"));
  assert.doesNotMatch(milestone7Block, /mouse\.click|keyboard\.type|clipboard\.write|ui\.invoke|ui\.set_value/);
});

test("Windows broker preserves observe commands and token-gates active commands", () => {
  const source = fs.readFileSync("services/windows-control-broker/Program.cs", "utf8");
  assert.match(source, /"window\.list"/);
  assert.match(source, /"ui\.get_tree"/);
  assert.match(source, /"screen\.capture"/);
  assert.match(source, /"ui\.highlight"/);
  assert.match(source, /CopyFromScreen/);
  assert.match(source, /ValidateApprovalToken/);
  assert.match(source, /HERMES_BROKER_APPROVAL_TOKEN/);
  assert.doesNotMatch(source, /Clipboard|credential\.enter|uac\.elevate/i);
});

test("computer observe manager constrains broker output and preserves observe policy", async () => {
  const source = fs.readFileSync("apps/studio-desktop/src/main/computer-observe-manager.ts", "utf8");
  assert.match(source, /artifacts", "milestone8", "captures"/);
  assert.match(source, /isPathInside\(this\.captureDir, filePath\)/);
  assert.match(source, /value\.width <= 0 \|\| value\.height <= 0/);
  assert.doesNotMatch(source, /shell:\s*true|clipboard\.(read|write|set|get)\s*\(|writeText\s*\(|readText\s*\(/i);

  const { ComputerObserveManager } = await import(managerModulePath);
  const manager = new ComputerObserveManager(path.resolve("."));
  const state = await manager.getState();
  assert.equal(state.policy.observeOnly, true);
  assert.equal(state.activePolicy.requiresApproval, true);
  assert.equal(state.activePolicy.allowDestructiveAction, false);
  assert.equal(Array.isArray(state.windows), true);
  await assert.rejects(
    () => manager.highlightElement({ bounds: { left: 0, top: 0, width: 0, height: 20 } }),
    /Invalid bounds width/
  );
});

test("preload exposes observe APIs and explicit active approval APIs without shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  assert.match(preloadSource, /getComputerState/);
  assert.match(preloadSource, /listComputerWindows/);
  assert.match(preloadSource, /getComputerUiTree/);
  assert.match(preloadSource, /captureComputerScreen/);
  assert.match(preloadSource, /highlightComputerElement/);
  assert.match(preloadSource, /proposeComputerAction/);
  assert.match(preloadSource, /reviewComputerAction/);
  assert.match(preloadSource, /executeComputerAction/);
  assert.match(preloadSource, /emergencyStopComputer/);
  assert.doesNotMatch(preloadSource, /sendComputerInput|clipboard|shell\./i);
});

test("Milestone 7 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone7.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-windows-broker-observe.ps1"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:[7-9]|[1-9][0-9]+)$/, `${packagePath} should be a current milestone version`);
  }
});
