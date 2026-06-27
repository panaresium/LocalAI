import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/profile-config-manager.js")).href;

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "studio-m3-"));
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
  await fs.mkdir(path.join(root, "packages"), { recursive: true });
  await fs.mkdir(path.join(root, "services"), { recursive: true });
  const hermesHome = path.join(root, ".hermes-home");
  await fs.mkdir(hermesHome, { recursive: true });
  return { root, hermesHome };
}

test("profile manager creates profile files and isolation folders", async () => {
  const { ProfileConfigManager } = await import(managerModulePath);
  const { root, hermesHome } = await createWorkspace();
  const manager = new ProfileConfigManager(root, { hermesHome });

  const profile = await manager.saveProfile({
    id: "ops-profile",
    label: "Ops Profile",
    files: {
      "SOUL.md": "Operate carefully.",
      "USER.md": "User preferences.",
      "MEMORY.md": "No durable memory yet."
    }
  });

  assert.equal(profile.id, "ops-profile");
  assert.equal(profile.files["SOUL.md"], "Operate carefully.");
  assert.equal(existsSync(path.join(root, "profiles", "ops-profile", "knowledge")), true);
  assert.equal(existsSync(path.join(root, "profiles", "ops-profile", "sessions")), true);
  assert.equal(existsSync(path.join(root, "profiles", "ops-profile", "tools")), true);
});

test("project registry is versioned and constrained to the workspace", async () => {
  const { ProfileConfigManager } = await import(managerModulePath);
  const { root, hermesHome } = await createWorkspace();
  const manager = new ProfileConfigManager(root, { hermesHome });

  await manager.saveProject({
    id: "local-work",
    label: "Local Work",
    rootPath: root,
    profileId: "default"
  });

  const registryPath = path.join(root, "projects", "project-registry.json");
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.activeProjectId, "local-work");
  assert.equal(registry.projects[0].profileId, "default");

  await assert.rejects(
    () => manager.saveProject({
      id: "outside",
      label: "Outside",
      rootPath: path.dirname(root),
      profileId: "default"
    }),
    /inside the Studio workspace/
  );
});

test("profile manager rejects unsafe ids", async () => {
  const { ProfileConfigManager } = await import(managerModulePath);
  const { root, hermesHome } = await createWorkspace();
  const manager = new ProfileConfigManager(root, { hermesHome });

  await assert.rejects(
    () => manager.saveProfile({
      id: "../bad",
      label: "Bad",
      files: {
        "SOUL.md": "",
        "USER.md": "",
        "MEMORY.md": ""
      }
    }),
    /Invalid profile id/
  );
});

test("Hermes config save creates a timestamped backup", async () => {
  const { ProfileConfigManager } = await import(managerModulePath);
  const { root, hermesHome } = await createWorkspace();
  const manager = new ProfileConfigManager(root, { hermesHome });
  await fs.writeFile(path.join(hermesHome, "config.yaml"), "model:\n  provider: custom\n", "utf8");

  const saved = await manager.saveHermesConfig({ text: "model:\n  provider: custom\n  default: qwen3.5:4b\n" });
  assert.match(saved.text, /qwen3\.5:4b/);

  const backups = await fs.readdir(path.join(root, "artifacts", "milestone3", "config-backups"));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^config\.yaml\..*\.bak$/);
});

test("backup export includes registry and excludes secret-bearing Hermes files", async () => {
  const { ProfileConfigManager } = await import(managerModulePath);
  const { root, hermesHome } = await createWorkspace();
  const manager = new ProfileConfigManager(root, { hermesHome });
  await fs.writeFile(path.join(hermesHome, "config.yaml"), "model:\n  provider: custom\n", "utf8");
  const fixtureKeyName = ["example", "api", "key"].join("_");
  await fs.writeFile(path.join(hermesHome, ".env"), `${fixtureKeyName}=placeholder-value\n`, "utf8");
  await fs.writeFile(path.join(hermesHome, "auth.json"), JSON.stringify({ session: "placeholder-value" }), "utf8");
  await manager.saveProject({
    id: "local-work",
    label: "Local Work",
    rootPath: root,
    profileId: "default"
  });

  const exported = await manager.exportBackup();
  const manifest = JSON.parse(await fs.readFile(exported.manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.excludes, [".env", "auth.json", "auth.lock", "state.db"]);
  assert.equal(existsSync(path.join(exported.exportPath, "projects", "project-registry.json")), true);
  assert.equal(existsSync(path.join(exported.exportPath, "hermes", "config.yaml")), true);
  assert.equal(existsSync(path.join(exported.exportPath, "hermes", ".env")), false);
  assert.equal(existsSync(path.join(exported.exportPath, "hermes", "auth.json")), false);
});

test("preload exposes profile config APIs without Node or shell access", () => {
  const preloadSource = existsSync("apps/studio-desktop/src/preload/preload.cts")
    ? readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8")
    : "";
  assert.match(preloadSource, /getProfileConfigState/);
  assert.match(preloadSource, /saveHermesConfig/);
  assert.match(preloadSource, /exportStudioBackup/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("process"/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("require"/);
  assert.doesNotMatch(preloadSource, /shell\./);
});
