import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Chat command plan cue includes confidence and approval gate metadata", () => {
  assert.match(rendererSource, /readonly confidencePercent: number/);
  assert.match(rendererSource, /readonly confidenceThresholdPercent: number/);
  assert.match(rendererSource, /readonly referencesRequired: boolean/);
  assert.match(rendererSource, /readonly approvalGate: string/);
  assert.match(rendererSource, /function chatCommandConfidencePercent\(command: string, route: CommandPlanRoute\): number/);
});

test("Chat cue confidence matches Command Center route confidence floors", () => {
  const confidenceFunction = sourceBetween(
    rendererSource,
    "function chatCommandConfidencePercent(command: string, route: CommandPlanRoute): number {",
    "function buildChatCommandPlanCue"
  );

  assert.match(confidenceFunction, /singapore standard time/);
  assert.match(confidenceFunction, /return 93/);
  assert.match(confidenceFunction, /route === "media-generation"/);
  assert.match(confidenceFunction, /route === "profile-config"/);
  assert.match(confidenceFunction, /route === "automation"/);
  assert.match(confidenceFunction, /route === "knowledge" \|\| route === "packaging-hardening"/);
  assert.match(confidenceFunction, /route === "app-adapters" \|\| route === "computer-control"/);
  assert.match(confidenceFunction, /return 90/);
});

test("Chat cue blocks preparation when confidence requires references", () => {
  const cueFunction = sourceBetween(
    rendererSource,
    "function buildChatCommandPlanCue(",
    "function buildCommandIntentChecklist"
  );

  assert.match(cueFunction, /const confidenceThresholdPercent = 90/);
  assert.match(cueFunction, /const referencesRequired = confidencePercent < confidenceThresholdPercent/);
  assert.match(cueFunction, /referencesRequired\s*\?\s*"Add references first"/);
  assert.match(cueFunction, /const canPrepare = trimmedCommand\.length <= maxChars && blockedTerms\.length === 0 && !referencesRequired/);
  assert.match(cueFunction, /canPrepare\s*\n\s*\};/);
});

test("Chat sidebar renders compact confidence and approval gate details", () => {
  const chatBlock = sourceBetween(
    rendererSource,
    '<section className="chat-workspace" aria-label="Simple chat">',
    '<section className="admin-workspace" aria-label="Profiles projects and config">'
  );

  assert.match(chatBlock, /className="chat-plan-gate" aria-label="Chat plan confidence and approval gate"/);
  assert.match(chatBlock, /<dt>Confidence<\/dt>/);
  assert.match(chatBlock, /\{chatCommandPlanCue\.confidencePercent\}% \/ \{chatCommandPlanCue\.confidenceThresholdPercent\}%/);
  assert.match(chatBlock, /<dt>Approval<\/dt>/);
  assert.match(chatBlock, /\{chatCommandPlanCue\.approvalGate\}/);
});

test("Chat plan confidence gate styling and scripts are registered", () => {
  assert.match(styleSource, /\.chat-plan-gate/);
  assert.match(styleSource, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styleSource, /\.chat-plan-gate dt/);
  assert.match(styleSource, /\.chat-plan-gate dd/);
  assert.equal(fs.existsSync("scripts/test-chat-plan-confidence-gate.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux44.ps1"), true);
  assert.equal(pkg.scripts["test:chat-plan-confidence-gate"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-plan-confidence-gate.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux44"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux44.ps1");
});
