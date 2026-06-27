import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const requiredPaths = [
  "apps/studio-desktop/package.json",
  "apps/studio-dashboard-plugin/package.json",
  "services/windows-control-broker/HermesLocalAI.WindowsBroker.csproj",
  "services/browser-control/package.json",
  "packages/contracts/package.json",
  "packages/hermes-client/package.json",
  "packages/ollama-client/package.json",
  "docs/adr"
];

test("Milestone 0 scaffold paths exist", () => {
  for (const requiredPath of requiredPaths) {
    assert.equal(fs.existsSync(requiredPath), true, `${requiredPath} should exist`);
  }
});
