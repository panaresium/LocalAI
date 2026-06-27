import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/teach-mode-manager.js")).href;

function selector(name, automationId = name.replace(/\s+/g, "")) {
  return {
    appProcess: "excel",
    windowTitle: "Quarterly workbook",
    automationId,
    name,
    controlType: "Button",
    bounds: null,
    semanticPath: ["excel", "Quarterly workbook", name]
  };
}

test("Milestone 12 Teach Mode contracts define supervised workflow policy", () => {
  const source = fs.readFileSync("packages/contracts/src/teach-mode.ts", "utf8");
  assert.match(source, /MILESTONE12_TEACH_MODE_POLICY/);
  assert.match(source, /semanticSelectorsPreferred:\s*true/);
  assert.match(source, /coordinatesFallbackOnly:\s*true/);
  assert.match(source, /replayRequiresApproval:\s*true/);
  assert.match(source, /skillConversionRequiresApproval:\s*true/);
  assert.match(source, /TeachWorkflowParameter/);
  assert.match(source, /TeachReplayPlan/);
  assert.match(source, /TeachSkillCandidate/);
});

test("Teach Mode manager records demonstration, generates workflow, gates replay, and converts skill candidate", async () => {
  const { TeachModeManager } = await import(managerModulePath);
  const manager = new TeachModeManager();

  let state = manager.getState();
  assert.equal(state.policy.milestone, 12);
  assert.equal(state.policy.replayRequiresApproval, true);

  state = manager.startSession({ name: "Export report to PDF" });
  const sessionId = state.activeSessionId;
  assert.ok(sessionId);
  manager.recordEvent({ kind: "app.focus", selector: selector("Excel app") });
  manager.recordEvent({ kind: "file.opened", selector: selector("Open workbook"), filePath: "D:\\Reports\\quarterly.xlsx" });
  manager.recordEvent({ kind: "ui.invoke", selector: selector("File") });
  manager.recordEvent({ kind: "ui.set_value", selector: selector("Output folder"), text: "D:\\Exports" });
  manager.recordEvent({ kind: "file.created", selector: selector("Created PDF"), filePath: "D:\\Exports\\quarterly.pdf" });
  state = manager.recordEvent({ kind: "final.state", selector: selector("Export complete"), text: "Export complete" });
  assert.equal(state.sessions[0]?.events.length, 6);

  state = manager.stopSession();
  assert.equal(state.sessions[0]?.status, "stopped");

  state = manager.generateWorkflow({ sessionId, name: "Export report to PDF" });
  const workflow = state.workflows[0];
  assert.ok(workflow);
  assert.match(workflow.yaml, /inputs:/);
  assert.match(workflow.yaml, /verification:/);
  assert.equal(workflow.parameters.some((parameter) => parameter.kind === "file"), true);
  assert.equal(workflow.verification.some((rule) => rule.kind === "file-exists"), true);
  assert.ok(workflow.reliabilityScore >= 0.7);

  state = manager.createReplay({ workflowId: workflow.id });
  const replay = state.replayPlans[0];
  assert.equal(replay?.dryRun, true);
  assert.equal(replay?.requiresApproval, true);
  assert.equal(replay?.status, "draft");
  assert.deepEqual(replay?.blockedReasons, []);

  state = manager.reviewReplay({ replayId: replay.id, decision: "approve", reviewNote: "test approval" });
  assert.equal(state.replayPlans[0]?.status, "approved");

  state = manager.convertToSkill({ workflowId: workflow.id });
  const skill = state.skillCandidates[0];
  assert.equal(skill?.status, "pending-approval");
  assert.match(skill?.body ?? "", /Workflow:/);
  assert.match(skill?.body ?? "", /explicit approval/);

  state = manager.reviewSkillCandidate({ candidateId: skill.id, decision: "approve", reviewNote: "test approval" });
  assert.equal(state.skillCandidates[0]?.status, "approved");
});

test("Teach Mode blocks sensitive content and flags coordinate fallback replay", async () => {
  const { TeachModeManager } = await import(managerModulePath);
  const manager = new TeachModeManager();
  manager.startSession({ name: "Coordinate fallback demo" });
  assert.throws(
    () => manager.recordEvent({
      kind: "keyboard.input",
      selector: selector("Password"),
      text: "my password"
    }),
    /Blocked sensitive/
  );
  manager.recordEvent({
    kind: "mouse.click",
    selector: {
      appProcess: "legacy",
      windowTitle: "Legacy app",
      automationId: null,
      name: null,
      controlType: null,
      bounds: { left: 10, top: 20, width: 50, height: 30 },
      semanticPath: []
    }
  });
  const stopped = manager.stopSession();
  const sessionId = stopped.sessions[0].id;
  const generated = manager.generateWorkflow({ sessionId, name: "Coordinate fallback demo" });
  const workflow = generated.workflows[0];
  assert.equal(workflow.steps[0]?.coordinateFallbackAllowed, true);
  const replayState = manager.createReplay({ workflowId: workflow.id });
  assert.equal(replayState.replayPlans[0]?.blockedReasons.some((reason) => reason.includes("Coordinate fallback")), true);
});

test("Studio exposes typed Teach Mode IPC without renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(preloadSource, /getTeachModeState/);
  assert.match(preloadSource, /recordTeachEvent/);
  assert.match(preloadSource, /convertTeachWorkflowToSkill/);
  assert.match(mainSource, /TeachModeManager/);
  assert.match(mainSource, /parseRecordTeachEventRequest/);
  assert.match(mainSource, /parseReviewTeachReplayRequest/);
  assert.match(rendererSource, /teach-workspace/);
  assert.match(rendererSource, /Record Event/);
  assert.match(rendererSource, /Dry-Run Replay/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 12 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone12.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-teach-mode.ps1"), true);
  assert.equal(fs.existsSync("apps/studio-desktop/src/main/teach-mode-manager.ts"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:1[2-9]|[2-9][0-9]+)$/, `${packagePath} should be milestone 12 or later`);
  }
});
