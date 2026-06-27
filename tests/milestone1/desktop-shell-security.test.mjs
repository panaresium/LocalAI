import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Electron renderer stays isolated from Node and OS privileges", () => {
  const mainSource = fs.readFileSync("apps/studio-desktop/src/main/main.ts", "utf8");
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /setWindowOpenHandler\(\(\)\s*=>\s*\(\{\s*action:\s*"deny"\s*\}\)\)/);
});

test("preload exposes a narrow Studio API namespace", () => {
  const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld\("hermesStudio", api\)/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("process"/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("require"/);
  assert.doesNotMatch(preloadSource, /shell\./);
});

test("desktop package pins renderer and Electron dependencies exactly", () => {
  const pkg = JSON.parse(fs.readFileSync("apps/studio-desktop/package.json", "utf8"));
  for (const dependencySet of [pkg.dependencies, pkg.devDependencies]) {
    for (const [name, version] of Object.entries(dependencySet)) {
      if (name === "@hermes-local-ai/contracts") {
        assert.equal(version, "workspace:*");
        continue;
      }

      assert.doesNotMatch(version, /^[~^*]/, `${name} should be pinned exactly`);
    }
  }
});

test("desktop build outputs main, preload, and renderer artifacts", () => {
  for (const outputPath of [
    "apps/studio-desktop/dist/main/main.js",
    "apps/studio-desktop/dist/main/service-supervisor.js",
    "apps/studio-desktop/dist/preload/preload.cjs",
    "apps/studio-desktop/dist/renderer/index.html"
  ]) {
    assert.equal(fs.existsSync(outputPath), true, `${outputPath} should exist`);
  }
});

test("desktop launch wrappers do not require pnpm on PATH", () => {
  for (const scriptPath of ["scripts/pnpm.ps1", "scripts/start-studio-desktop.ps1"]) {
    assert.equal(fs.existsSync(scriptPath), true, `${scriptPath} should exist`);
  }

  const pkg = JSON.parse(fs.readFileSync("apps/studio-desktop/package.json", "utf8"));
  assert.doesNotMatch(pkg.scripts.build, /\bpnpm\b/, "build script should not shell out to pnpm");
  assert.doesNotMatch(pkg.scripts.start, /\bpnpm\b/, "start script should not shell out to pnpm");

  const wrapperSource = fs.readFileSync("scripts/pnpm.ps1", "utf8");
  assert.match(wrapperSource, /codex-primary-runtime\\dependencies\\bin\\pnpm\.cmd/);
  assert.match(wrapperSource, /corepack/);
});
