import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const supervisorModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/service-supervisor.js")).href;
const workspaceRootModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/workspace-root.js")).href;

test("desktop main resolves the workspace root from built output paths", async () => {
  const { createStudioServiceDefinitions } = await import(supervisorModulePath);
  const { resolveWorkspaceRoot } = await import(workspaceRootModulePath);
  const root = resolveWorkspaceRoot(path.resolve("apps/studio-desktop/dist/main"));
  assert.equal(root, path.resolve("."));

  const definitions = createStudioServiceDefinitions(root);
  const windowsBroker = definitions.find((definition) => definition.id === "windows-broker");
  const browserControl = definitions.find((definition) => definition.id === "browser-control");
  assert.equal((await windowsBroker?.healthProbe())?.state, "healthy");
  assert.equal((await browserControl?.healthProbe())?.state, "healthy");
});

test("service supervisor generates redacted local auth metadata", async () => {
  const { StudioServiceSupervisor } = await import(supervisorModulePath);
  const supervisor = new StudioServiceSupervisor([
    {
      id: "probe",
      label: "Probe",
      description: "Test probe",
      healthProbe: async () => ({
        state: "healthy",
        checkedAt: new Date().toISOString(),
        detail: "ok"
      })
    }
  ]);

  const snapshot = await supervisor.getSnapshot();
  assert.equal(typeof supervisor.getBearerToken(), "string");
  assert.equal(snapshot.auth.tokenId.length, 16);
  assert.equal(Object.hasOwn(snapshot.auth, "token"), false);
  assert.deepEqual(snapshot.auth.scopes, ["studio.local", "service.health", "service.lifecycle"]);
});

test("service supervisor starts, reports, stops, and logs only owned processes", async () => {
  const { StudioServiceSupervisor } = await import(supervisorModulePath);
  const tempDir = await mkdtemp(path.join(tmpdir(), "studio-supervisor-"));
  const logFilePath = path.join(tempDir, "supervisor.jsonl");
  const supervisor = new StudioServiceSupervisor(
    [
      {
        id: "managed-test",
        label: "Managed Test",
        description: "Long-running child process for lifecycle validation",
        startCommand: {
          command: process.execPath,
          args: ["-e", "console.log('ready'); setInterval(() => {}, 1000);"]
        },
        stopTimeoutMs: 1000,
        healthProbe: async () => ({
          state: "healthy",
          checkedAt: new Date().toISOString(),
          detail: "test health"
        })
      }
    ],
    { logFilePath }
  );

  try {
    await supervisor.startService("managed-test");
    const running = await supervisor.getSnapshot();
    const runningService = running.services.find((service) => service.id === "managed-test");
    assert.equal(runningService?.lifecycle, "running");
    assert.equal(runningService?.stoppable, true);
    assert.equal(typeof runningService?.pid, "number");

    await supervisor.stopService("managed-test");
    const stopped = await supervisor.getSnapshot();
    const stoppedService = stopped.services.find((service) => service.id === "managed-test");
    assert.equal(stoppedService?.lifecycle, "stopped");
    assert.equal(stoppedService?.startable, true);

    const logText = await readFile(logFilePath, "utf8");
    assert.match(logText, /Starting service/);
    assert.match(logText, /Stopping service/);
  } finally {
    await supervisor.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("service supervisor rejects invalid service ids", async () => {
  const { StudioServiceSupervisor } = await import(supervisorModulePath);
  const supervisor = new StudioServiceSupervisor([]);
  await assert.rejects(() => supervisor.startService("../bad"), /Invalid service id/);
});
