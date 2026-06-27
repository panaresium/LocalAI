import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Command safety preview uses local Command Center policy", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /function commandContainsBlockedTerm\(command: string, term: string\): boolean/);
  assert.match(rendererSource, /commandPolicy = commandCenterState\?\.policy \?\? null/);
  assert.match(rendererSource, /commandLengthLimit = commandPolicy\?\.maxCommandChars \?\? 600/);
  assert.match(rendererSource, /blockedCommandTerms = \(commandPolicy\?\.blockedTerms \?\? \[\]\)\.filter/);
  assert.match(rendererSource, /commandContainsBlockedTerm\(commandText, term\)/);
});

test("Command safety preview renders bounded status before planning", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /maxLength=\{commandLengthLimit\}/);
  assert.match(rendererSource, /className="command-safety-preview"/);
  assert.match(rendererSource, /aria-label="Command safety preview"/);
  assert.match(rendererSource, /commandCharsRemaining/);
  assert.match(rendererSource, /blockedCommandTerms\.join\(", "\)/);
  assert.match(rendererSource, /A plan can be created for review, but it cannot be approved\./);
});

test("Command safety preview preserves approval-gated draft planning", () => {
  const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
  assert.match(rendererSource, /createCommandPlan/);
  assert.doesNotMatch(rendererSource, /disabled=\{blockedCommandTerms/);
  assert.doesNotMatch(rendererSource, /reviewCommandPlan\(blockedCommandTerms/);
});

test("Command safety preview styling and validation scripts are present", () => {
  const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
  assert.match(styleSource, /\.command-safety-preview/);
  assert.match(styleSource, /\.command-safety-note/);
  assert.equal(fs.existsSync("scripts/test-command-safety-preview.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux7.ps1"), true);
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["test:command-safety-preview"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-command-safety-preview.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux7"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux7.ps1");
});
