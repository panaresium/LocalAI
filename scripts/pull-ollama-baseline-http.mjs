import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "ai_model_download_manifest.json");
const checkpointDir = path.join(root, "artifacts", "checkpoints");
const checkpointPath = path.join(checkpointDir, "ollama-baseline-http.json");
const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

async function readCheckpoint() {
  try {
    return JSON.parse(await fs.readFile(checkpointPath, "utf8"));
  } catch {
    return {
      updatedAt: null,
      pulled: [],
      failed: []
    };
  }
}

async function writeCheckpoint(checkpoint) {
  await fs.mkdir(checkpointDir, { recursive: true });
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.pulled = [...new Set(checkpoint.pulled)].sort();
  await fs.writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

async function requestJson(route, init) {
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

async function pullModel(name) {
  const response = await fetch(`${baseUrl}/api/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, stream: true })
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`/api/pull ${name} returned ${response.status}: ${text.slice(0, 500)}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let lastStatus = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      const event = JSON.parse(line);
      if (event.status && event.status !== lastStatus) {
        lastStatus = event.status;
        console.log(`${name}: ${event.status}`);
      }
      if (event.error) {
        throw new Error(event.error);
      }
    }
  }

  if (buffer.trim().length > 0) {
    const event = JSON.parse(buffer);
    if (event.error) {
      throw new Error(event.error);
    }
  }
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const checkpoint = await readCheckpoint();
  const version = await requestJson("/api/version");
  console.log(`Ollama API ${version.version} at ${baseUrl}`);

  for (const entry of manifest.ollama_models_baseline) {
    const model = entry.model;
    if (checkpoint.pulled.includes(model)) {
      console.log(`Skipping ${model}; checkpoint already contains it.`);
      continue;
    }

    console.log(`Pulling ${model} through Ollama HTTP API...`);
    try {
      await pullModel(model);
      checkpoint.pulled.push(model);
      checkpoint.failed = checkpoint.failed.filter((failure) => failure.model !== model);
      await writeCheckpoint(checkpoint);
    } catch (error) {
      checkpoint.failed.push({
        model,
        at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      await writeCheckpoint(checkpoint);
      throw error;
    }
  }

  console.log(`Baseline Ollama HTTP checkpoint updated: ${checkpointPath}`);
}

await main();
