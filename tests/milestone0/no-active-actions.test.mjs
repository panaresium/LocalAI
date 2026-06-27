import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Milestone 0 computer contracts expose observe-only actions", () => {
  const source = fs.readFileSync("packages/contracts/src/computer-actions.ts", "utf8");
  assert.match(source, /OBSERVE_ONLY_ACTIONS = \["window\.list", "ui\.get_tree"\]/);
  assert.match(source, /allowInput: false/);
  assert.match(source, /allowDestructiveAction: false/);
  assert.match(source, /allowElevation: false/);
});

test("Windows broker preserves observe commands and token-gates any active input commands", () => {
  const source = fs.readFileSync("services/windows-control-broker/Program.cs", "utf8");
  assert.match(source, /window\.list/);
  assert.match(source, /ui\.get_tree/);
  assert.doesNotMatch(source, /clipboard\.write|payment\.confirm|credential\.enter|uac\.elevate/i);
  if (/keyboard\.type|mouse\.click|ui\.invoke/.test(source)) {
    assert.match(source, /ValidateApprovalToken/);
    assert.match(source, /HERMES_BROKER_APPROVAL_TOKEN/);
    assert.match(source, /activeCommandsRequireApprovalToken = true/);
  }
});
