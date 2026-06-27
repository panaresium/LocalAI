import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "milestone0");
const outputPath = path.join(artifactsDir, "ollama-probe.json");
const manifestPath = path.join(root, "ai_model_download_manifest.json");
const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

async function requestJson(route, init) {
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

async function writeResult(result) {
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const expectedModels = manifest.ollama_models_baseline.map((entry) => entry.model);
  const result = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    version: null,
    tags: null,
    psBefore: null,
    psAfterLoad: null,
    psAfterUnload: null,
    unloadPolls: [],
    expectedModels,
    missingBaselineModels: [],
    lifecycleModel: "qwen3.5:4b",
    lifecycleVerified: false,
    unloadVerified: false,
    errors: []
  };

  try {
    result.version = await requestJson("/api/version");
    result.tags = await requestJson("/api/tags");
    const installed = new Set((result.tags.models ?? []).map((model) => model.name));
    result.missingBaselineModels = expectedModels.filter((model) => !installed.has(model));
    result.psBefore = await requestJson("/api/ps");

    if (!installed.has(result.lifecycleModel)) {
      result.errors.push(`Lifecycle model ${result.lifecycleModel} is not installed.`);
    } else {
      await requestJson("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: result.lifecycleModel,
          prompt: "",
          stream: false,
          keep_alive: "1m"
        })
      });
      result.psAfterLoad = await requestJson("/api/ps");

      await requestJson("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: result.lifecycleModel,
          prompt: "",
          stream: false,
          keep_alive: 0
        })
      });
      result.psAfterUnload = await requestJson("/api/ps");
      result.unloadPolls.push(result.psAfterUnload);

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const loaded = (result.psAfterUnload.models ?? []).some(
          (model) => model.name === result.lifecycleModel || model.model === result.lifecycleModel
        );
        if (!loaded) {
          result.unloadVerified = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        result.psAfterUnload = await requestJson("/api/ps");
        result.unloadPolls.push(result.psAfterUnload);
      }

      result.lifecycleVerified =
        (result.psAfterLoad.models ?? []).some(
          (model) => model.name === result.lifecycleModel || model.model === result.lifecycleModel
        ) && result.unloadVerified;

      if (!result.unloadVerified) {
        result.errors.push(`${result.lifecycleModel} remained listed in /api/ps after keep_alive: 0.`);
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  await writeResult(result);
  if (result.errors.length > 0 || result.missingBaselineModels.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

await main();
