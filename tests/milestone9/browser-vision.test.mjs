import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/browser-vision-manager.js")).href;

test("Milestone 9 browser vision contracts define DOM-first fallback policy", () => {
  const source = fs.readFileSync("packages/contracts/src/browser-vision.ts", "utf8");
  assert.match(source, /MILESTONE9_BROWSER_VISION_POLICY/);
  assert.match(source, /preferredAutomation:\s*"browser-dom"/);
  assert.match(source, /fallbackAutomation:\s*"screenshot-visual-grounding"/);
  assert.match(source, /requiresApprovalForLowConfidence:\s*true/);
  assert.match(source, /lowConfidenceThreshold:\s*0\.72/);
  assert.match(source, /browser\.passwords/);
  assert.match(source, /browser\.cookies/);
  assert.match(source, /browser\.payment-methods/);
});

test("browser vision runner uses ephemeral Playwright sessions and emits overlays", () => {
  const source = fs.readFileSync("services/browser-control/browser-vision-runner.mjs", "utf8");
  assert.match(source, /launchPersistentContext/);
  assert.match(source, /profile-\$\{engine\}-\$\{Date\.now\(\)\}/);
  assert.match(source, /channel: engine === "edge" \? "msedge" : "chrome"/);
  assert.match(source, /data-hermes-overlay/);
  assert.match(source, /LOW_CONFIDENCE_THRESHOLD = 0\.72/);
  assert.doesNotMatch(source, /Login Data|Default\\\\|User Data|password|cookies|history/i);
});

test("browser vision manager creates and reviews low-confidence approval", async () => {
  const { BrowserVisionManager } = await import(managerModulePath);
  const manager = new BrowserVisionManager(path.resolve("."));
  const initial = manager.getState();
  assert.equal(initial.policy.milestone, 9);
  assert.equal(initial.policy.requiresApprovalForLowConfidence, true);

  const inspected = await manager.inspect({ engine: "edge" });
  assert.equal(inspected.lastInspection?.command, "browser.inspect");
  assert.ok((inspected.lastInspection?.elements.length ?? 0) >= 3);

  const domGrounded = await manager.ground({
    engine: "edge",
    query: "Run Browser Probe"
  });
  assert.equal(domGrounded.lastGrounding?.requiresApproval, false);
  assert.equal(domGrounded.lastGrounding?.candidates[0]?.source, "dom");

  const fallback = await manager.ground({
    engine: "edge",
    query: "zebra coordinate"
  });
  assert.equal(fallback.lastGrounding?.requiresApproval, true);
  const pending = fallback.approvals.find((approval) => approval.status === "pending");
  assert.ok(pending, "expected a pending low-confidence browser approval");
  assert.equal(pending?.candidate.source, "vision-fallback");

  const reviewed = manager.review({
    approvalId: pending.id,
    decision: "approve",
    reviewNote: "test approval"
  });
  assert.equal(reviewed.approvals.find((approval) => approval.id === pending.id)?.status, "approved");

  await assert.rejects(
    () => manager.ground({
      engine: "edge",
      query: "browser password database"
    }),
    /Blocked browser grounding target/
  );
});

test("Studio exposes typed browser vision IPC without renderer shell access", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  assert.match(preloadSource, /getBrowserVisionState/);
  assert.match(preloadSource, /inspectBrowser/);
  assert.match(preloadSource, /groundBrowserElement/);
  assert.match(preloadSource, /reviewBrowserGrounding/);
  assert.match(mainSource, /BrowserVisionManager/);
  assert.match(mainSource, /parseGroundBrowserElementRequest/);
  assert.match(mainSource, /parseReviewBrowserGroundingRequest/);
  assert.doesNotMatch(preloadSource, /shell\.|require\(|process\./);
  assert.doesNotMatch(mainSource, /nodeIntegration:\s*true|contextIsolation:\s*false|sandbox:\s*false/);
});

test("Milestone 9 runner and package versions are present", () => {
  assert.equal(fs.existsSync("scripts/run-milestone9.ps1"), true);
  assert.equal(fs.existsSync("scripts/test-browser-vision.ps1"), true);
  assert.equal(fs.existsSync("services/browser-control/browser-vision-runner.mjs"), true);

  for (const packagePath of [
    "package.json",
    "apps/studio-desktop/package.json",
    "packages/contracts/package.json",
    "services/browser-control/package.json"
  ]) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.match(pkg.version, /^0\.0\.0-milestone(?:9|[1-9][0-9]+)$/, `${packagePath} should be a current milestone version`);
  }
});
