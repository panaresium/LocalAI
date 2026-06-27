import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const filterIds = ["all", "draft", "approved", "rejected", "blocked"];

test("Command queue defines typed filters", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /type CommandPlanFilter/);
  assert.match(rendererSource, /type CommandPlanFilterOption/);
  assert.match(rendererSource, /const COMMAND_PLAN_FILTERS/);
  for (const id of filterIds) {
    assert.match(rendererSource, new RegExp(`id: "${id}"`));
  }
  assert.match(rendererSource, /function commandPlanMatchesFilter\(plan: CommandPlan, filter: CommandPlanFilter\): boolean/);
  assert.match(rendererSource, /filter === "blocked"/);
  assert.match(rendererSource, /plan\.blockedReasons\.length > 0/);
});

test("Command queue filters are local renderer state", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /useState<CommandPlanFilter>\("all"\)/);
  assert.match(rendererSource, /filteredCommandPlans = recentCommandPlans\.filter/);
  assert.match(rendererSource, /commandPlanFilterCounts: Record<CommandPlanFilter, number>/);
  assert.match(rendererSource, /selectedCommandPlan = filteredCommandPlans\.find/);
  assert.match(rendererSource, /setCommandPlanFilter\(filter\.id\)/);
});

test("Command queue renders filtered plan controls", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(rendererSource, /className="command-plan-filter"/);
  assert.match(rendererSource, /aria-label="Command plan filters"/);
  assert.match(rendererSource, /aria-pressed=\{commandPlanFilter === filter\.id\}/);
  assert.match(rendererSource, /filteredCommandPlans\.map/);
  assert.match(rendererSource, /filteredCommandPlans\.length === 0/);
  assert.match(styleSource, /\.command-plan-filter/);
});

test("Command queue filters preserve review isolation and package scripts", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.doesNotMatch(rendererSource, /reviewCommandPlan\(filter/);
  assert.match(preloadSource, /reviewCommandPlan/);
  assert.doesNotMatch(preloadSource, /shell\./);
  assert.doesNotMatch(preloadSource, /require\(/);
  assert.doesNotMatch(preloadSource, /process\./);
  assert.equal(fs.existsSync("scripts/test-command-queue-filters.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux8.ps1"), true);
  assert.equal(pkg.scripts["test:command-queue-filters"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-queue-filters.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux8"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux8.ps1");
});
