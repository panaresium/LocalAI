import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, appendFile } from "node:fs/promises";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

import type {
  LocalAuthTokenInfo,
  ServiceHealth,
  ServiceLogEntry,
  ServiceStatus,
  ServiceSupervisorSnapshot
} from "@hermes-local-ai/contracts";

export interface ServiceCommand {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface ServiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly startCommand?: ServiceCommand;
  readonly healthProbe: () => Promise<ServiceHealth>;
  readonly stopTimeoutMs?: number;
}

export interface StudioServiceSupervisorOptions {
  readonly logFilePath?: string;
  readonly tokenTtlMs?: number;
  readonly maxLogs?: number;
}

interface ManagedProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly startedAt: string;
}

const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_MAX_LOGS = 500;

export class StudioServiceSupervisor {
  private readonly definitions: ReadonlyMap<string, ServiceDefinition>;
  private readonly processes = new Map<string, ManagedProcess>();
  private readonly logs: ServiceLogEntry[] = [];
  private readonly tokenSecret: string;
  private readonly authInfo: LocalAuthTokenInfo;
  private readonly logFilePath: string | undefined;
  private readonly maxLogs: number;
  private nextLogId = 1;
  private shuttingDown = false;

  public constructor(
    definitions: readonly ServiceDefinition[],
    options: StudioServiceSupervisorOptions = {}
  ) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
    this.tokenSecret = randomBytes(32).toString("base64url");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + (options.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS));
    this.authInfo = {
      tokenId: createHash("sha256").update(this.tokenSecret).digest("hex").slice(0, 16),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      scopes: ["studio.local", "service.health", "service.lifecycle"]
    };
    this.logFilePath = options.logFilePath;
    this.maxLogs = options.maxLogs ?? DEFAULT_MAX_LOGS;
  }

  public getBearerToken(): string {
    return this.tokenSecret;
  }

  public async startService(serviceId: string): Promise<void> {
    const definition = this.requireDefinition(serviceId);
    if (!definition.startCommand) {
      this.appendLog(serviceId, "warn", "Service is externally managed and cannot be started by the Studio.");
      return;
    }

    const existing = this.processes.get(serviceId);
    if (existing && existing.child.exitCode === null) {
      this.appendLog(serviceId, "info", "Service is already running.");
      return;
    }

    this.appendLog(serviceId, "info", "Starting service.");
    const child = spawn(definition.startCommand.command, definition.startCommand.args ?? [], {
      cwd: definition.startCommand.cwd,
      env: {
        ...process.env,
        ...(definition.startCommand.env ?? {})
      },
      windowsHide: true,
      shell: false
    });

    child.stdout.on("data", (chunk: Buffer) => {
      this.appendLog(serviceId, "info", chunk.toString("utf8").trim());
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.appendLog(serviceId, "warn", chunk.toString("utf8").trim());
    });
    child.on("error", (error: Error) => {
      this.appendLog(serviceId, "error", error.message);
    });
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      this.processes.delete(serviceId);
      this.appendLog(serviceId, code === 0 ? "info" : "warn", `Service exited with code ${code ?? "null"} and signal ${signal ?? "null"}.`);
    });

    this.processes.set(serviceId, {
      child,
      startedAt: new Date().toISOString()
    });
  }

  public async stopService(serviceId: string): Promise<void> {
    const definition = this.requireDefinition(serviceId);
    const managed = this.processes.get(serviceId);
    if (!managed || managed.child.exitCode !== null) {
      this.appendLog(serviceId, "info", "No Studio-owned process is running for this service.");
      return;
    }

    this.appendLog(serviceId, "info", "Stopping service.");
    await this.stopManagedProcess(serviceId, managed, definition.stopTimeoutMs ?? 5000);
  }

  public async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.appendLog("studio", "info", "Clean shutdown requested.");
    const stopTasks = [...this.processes.entries()].map(async ([serviceId, managed]) => {
      const definition = this.definitions.get(serviceId);
      await this.stopManagedProcess(serviceId, managed, definition?.stopTimeoutMs ?? 5000);
    });
    await Promise.all(stopTasks);
    this.appendLog("studio", "info", "Clean shutdown complete.");
  }

  public async getSnapshot(): Promise<ServiceSupervisorSnapshot> {
    const statuses = await Promise.all(
      [...this.definitions.values()].map((definition) => this.getServiceStatus(definition))
    );

    return {
      generatedAt: new Date().toISOString(),
      auth: this.authInfo,
      services: statuses,
      logs: [...this.logs],
      shuttingDown: this.shuttingDown
    };
  }

  private async getServiceStatus(definition: ServiceDefinition): Promise<ServiceStatus> {
    const managed = this.processes.get(definition.id);
    const isManagedRunning = Boolean(managed && managed.child.exitCode === null);
    const health = await definition.healthProbe();

    const status: ServiceStatus = {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      lifecycle: isManagedRunning ? "running" : definition.startCommand ? "stopped" : "external",
      startable: Boolean(definition.startCommand) && !isManagedRunning && !this.shuttingDown,
      stoppable: isManagedRunning && !this.shuttingDown,
      health
    };

    if (isManagedRunning && typeof managed?.child.pid === "number") {
      return {
        ...status,
        pid: managed.child.pid
      };
    }

    return status;
  }

  private requireDefinition(serviceId: string): ServiceDefinition {
    if (!/^[a-z0-9][a-z0-9.-]{0,63}$/u.test(serviceId)) {
      throw new Error("Invalid service id.");
    }

    const definition = this.definitions.get(serviceId);
    if (!definition) {
      throw new Error(`Unknown service id: ${serviceId}`);
    }

    return definition;
  }

  private async stopManagedProcess(
    serviceId: string,
    managed: ManagedProcess,
    timeoutMs: number
  ): Promise<void> {
    if (managed.child.exitCode !== null) {
      this.processes.delete(serviceId);
      return;
    }

    const exitPromise = new Promise<void>((resolve) => {
      managed.child.once("exit", () => resolve());
    });

    managed.child.kill();
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (managed.child.exitCode === null) {
          this.appendLog(serviceId, "warn", "Service did not stop in time; forcing termination.");
          managed.child.kill("SIGKILL");
        }
        resolve();
      }, timeoutMs);
    });

    await Promise.race([exitPromise, timeout]);
    this.processes.delete(serviceId);
  }

  private appendLog(serviceId: string, level: ServiceLogEntry["level"], message: string): void {
    if (!message) {
      return;
    }

    const entry: ServiceLogEntry = {
      id: this.nextLogId,
      timestamp: new Date().toISOString(),
      serviceId,
      level,
      message
    };
    this.nextLogId += 1;
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }

    if (this.logFilePath) {
      void this.writeLogEntry(entry);
    }
  }

  private async writeLogEntry(entry: ServiceLogEntry): Promise<void> {
    if (!this.logFilePath) {
      return;
    }

    await mkdir(dirname(this.logFilePath), { recursive: true });
    await appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

export function createStudioServiceDefinitions(root: string): readonly ServiceDefinition[] {
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const hermesExe = join(localAppData, "hermes", "hermes-agent", "venv", "Scripts", "hermes.exe");
  const ollamaExe = join(localAppData, "Programs", "Ollama", "ollama.exe");
  const brokerExe = join(root, "services", "windows-control-broker", "bin", "Release", "net8.0-windows", "HermesLocalAI.WindowsBroker.exe");
  const browserSmoke = join(root, "services", "browser-control", "browser-smoke.mjs");
  const browserVisionRunner = join(root, "services", "browser-control", "browser-vision-runner.mjs");

  return [
    {
      id: "ollama-api",
      label: "Ollama API",
      description: "Local model runtime HTTP API on localhost.",
      healthProbe: createHttpJsonHealthProbe("http://127.0.0.1:11434/api/version", "Ollama API responded.")
    },
    {
      id: "ollama-cli",
      label: "Ollama CLI",
      description: "Installed Ollama executable used for manual model operations.",
      healthProbe: createExecutableHealthProbe(ollamaExe, ["--version"], "Ollama CLI is available.")
    },
    {
      id: "hermes-agent",
      label: "Hermes Agent",
      description: "Pinned Hermes Agent executable and local provider configuration.",
      healthProbe: createExecutableHealthProbe(hermesExe, ["--version"], "Hermes Agent is available.")
    },
    {
      id: "windows-broker",
      label: "Windows Broker",
      description: "Observe-only .NET Windows UI Automation broker.",
      healthProbe: createExecutableHealthProbe(brokerExe, ["window.list"], "Windows broker responded.")
    },
    {
      id: "browser-control",
      label: "Browser Control",
      description: "Playwright-based browser DOM and visual grounding assets.",
      healthProbe: async () => {
        if (!existsSync(browserSmoke)) {
          return {
            state: "unhealthy",
            checkedAt: new Date().toISOString(),
            detail: `Missing file: ${browserSmoke}`
          };
        }
        if (!existsSync(browserVisionRunner)) {
          return {
            state: "unhealthy",
            checkedAt: new Date().toISOString(),
            detail: `Missing file: ${browserVisionRunner}`
          };
        }
        return {
          state: "healthy",
          checkedAt: new Date().toISOString(),
          detail: "Browser control smoke and visual grounding assets are present."
        };
      }
    }
  ];
}

export function createHttpJsonHealthProbe(url: string, healthyDetail: string): () => Promise<ServiceHealth> {
  return async () => {
    const startedAt = performance.now();
    return new Promise<ServiceHealth>((resolve) => {
      const req = request(url, { method: "GET", timeout: 2000 }, (res) => {
        res.resume();
        const latencyMs = Math.round(performance.now() - startedAt);
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            state: "healthy",
            checkedAt: new Date().toISOString(),
            detail: healthyDetail,
            latencyMs
          });
          return;
        }

        resolve({
          state: "unhealthy",
          checkedAt: new Date().toISOString(),
          detail: `HTTP status ${res.statusCode ?? "unknown"}.`,
          latencyMs
        });
      });

      req.on("timeout", () => {
        req.destroy(new Error("Health probe timed out."));
      });
      req.on("error", (error: Error) => {
        resolve({
          state: "unhealthy",
          checkedAt: new Date().toISOString(),
          detail: error.message,
          latencyMs: Math.round(performance.now() - startedAt)
        });
      });
      req.end();
    });
  };
}

export function createExecutableHealthProbe(
  executable: string,
  args: readonly string[],
  healthyDetail: string
): () => Promise<ServiceHealth> {
  return async () => {
    const startedAt = performance.now();
    if (!existsSync(executable)) {
      return {
        state: "unhealthy",
        checkedAt: new Date().toISOString(),
        detail: `Missing executable: ${executable}`
      };
    }

    return new Promise<ServiceHealth>((resolve) => {
      const child = spawn(executable, args, {
        windowsHide: true,
        shell: false
      });
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill();
        stderr = "Health probe timed out.";
      }, 5000);

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error: Error) => {
        clearTimeout(timeout);
        resolve({
          state: "unhealthy",
          checkedAt: new Date().toISOString(),
          detail: error.message,
          latencyMs: Math.round(performance.now() - startedAt)
        });
      });
      child.on("close", (code: number | null) => {
        clearTimeout(timeout);
        resolve({
          state: code === 0 ? "healthy" : "unhealthy",
          checkedAt: new Date().toISOString(),
          detail: code === 0 ? healthyDetail : (stderr.trim() || `Exited with code ${code ?? "null"}.`),
          latencyMs: Math.round(performance.now() - startedAt)
        });
      });
    });
  };
}

export function createFileHealthProbe(filePath: string, healthyDetail: string): () => Promise<ServiceHealth> {
  return async () => ({
    state: existsSync(filePath) ? "healthy" : "unhealthy",
    checkedAt: new Date().toISOString(),
    detail: existsSync(filePath) ? healthyDetail : `Missing file: ${filePath}`
  });
}
