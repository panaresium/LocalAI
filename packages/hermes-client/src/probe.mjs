import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "milestone0");
const outputPath = path.join(artifactsDir, "hermes-probe.json");
const localAppData = process.env.LOCALAPPDATA ?? "";
const candidatePaths = [
  path.join(localAppData, "hermes", "hermes-agent", "venv", "Scripts", "hermes.exe"),
  "hermes"
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveHermesCommand() {
  for (const candidate of candidatePaths) {
    if (candidate === "hermes") {
      const pathProbe = await run("where.exe", ["hermes"], 5000);
      return pathProbe.ok ? candidate : null;
    }

    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function run(command, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: root,
        windowsHide: true,
        shell: false,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1"
        }
      });
    } catch (error) {
      resolve({
        ok: false,
        code: null,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      stderr += `\nTimed out after ${timeoutMs}ms`;
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

async function writeResult(result) {
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
  const command = await resolveHermesCommand();
  const result = {
    checkedAt: new Date().toISOString(),
    command,
    version: null,
    help: null,
    doctor: null,
    singleQuery: null,
    singleQueryAttempts: [],
    streamVerified: false,
    errors: []
  };

  if (!command) {
    result.errors.push("Hermes executable was not found on PATH or in %LOCALAPPDATA%\\hermes.");
    await writeResult(result);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  result.version = await run(command, ["--version"], 15000);
  result.help = await run(command, ["--help"], 15000);

  if (process.env.HERMES_MILESTONE0_RUN_DOCTOR === "1") {
    result.doctor = await run(command, ["doctor"], 45000);
  }

  if (process.env.HERMES_MILESTONE0_RUN_CHAT === "1") {
    const prompt = "Acknowledge this local inference probe with a short confirmation.";
    const attempts = [
      {
        name: "configured-default",
        args: ["-z", prompt]
      },
      {
        name: "local-ollama-qwen3.5-4b",
        args: ["--provider", "ollama", "--model", "qwen3.5:4b", "-z", prompt]
      }
    ];

    for (const attempt of attempts) {
      const probe = await run(command, attempt.args, 120000);
      const cleanOutput = stripAnsi(probe.stdout).trim();
      const cleanError = stripAnsi(probe.stderr).trim();
      const combinedOutput = `${cleanOutput}\n${cleanError}`;
      const hasProviderFailure =
        /no inference provider configured/i.test(combinedOutput) ||
        /no llm provider configured/i.test(combinedOutput) ||
        /run [`']?hermes model[`']?/i.test(combinedOutput) ||
        /agent failed/i.test(combinedOutput);
      const success =
        probe.ok &&
        cleanOutput.length > 0 &&
        !hasProviderFailure;

      const attemptResult = {
        name: attempt.name,
        args: attempt.args,
        ...probe,
        cleanOutput,
        cleanError,
        success
      };
      result.singleQueryAttempts.push(attemptResult);
      result.singleQuery = attemptResult;

      if (success) {
        result.streamVerified = true;
        break;
      }
    }

    if (!result.streamVerified) {
      result.errors.push(
        "Hermes single-query probe did not complete successfully. Configure Hermes with a local Ollama provider/model or a permitted external provider and rerun."
      );
    }
  } else {
    result.errors.push(
      "Hermes single-query stream probe was not run. Set HERMES_MILESTONE0_RUN_CHAT=1 after confirming provider/model configuration."
    );
  }

  if (!result.version?.ok) {
    result.errors.push("Hermes version probe failed.");
  }

  await writeResult(result);
  if (result.errors.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

await main();
