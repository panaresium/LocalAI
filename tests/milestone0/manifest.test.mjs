import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("baseline Ollama manifest has required model roles", () => {
  const manifest = JSON.parse(fs.readFileSync("ai_model_download_manifest.json", "utf8"));
  const baseline = new Map(manifest.ollama_models_baseline.map((entry) => [entry.role, entry]));

  for (const role of [
    "controller.fast",
    "agent.general",
    "vision.ui_grounding",
    "retrieval.embedding"
  ]) {
    assert.equal(baseline.has(role), true, `missing baseline role ${role}`);
    assert.equal(typeof baseline.get(role).model, "string");
    assert.match(baseline.get(role).source_url, /^https:\/\//);
  }
});
