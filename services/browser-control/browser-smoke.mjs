import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "milestone0");
const outputPath = path.join(artifactsDir, "browser-smoke.json");
const testPagePath = path.join(artifactsDir, "browser-test.html");

function loadPlaywright() {
  try {
    return require("@playwright/test");
  } catch {
    // Fall through to the runtime package name used by some Playwright installs.
  }

  try {
    return require("playwright");
  } catch (firstError) {
    const fallback = process.env.PLAYWRIGHT_BUNDLED_PATH;
    if (fallback) {
      return require(fallback);
    }

    throw firstError;
  }
}

async function writeTestPage() {
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(
    testPagePath,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Hermes Local AI Studio Milestone 0</title>
  </head>
  <body>
    <main>
      <h1>Hermes Local AI Studio</h1>
      <button id="probe">Run Probe</button>
      <output id="result">idle</output>
    </main>
    <script>
      document.getElementById("probe").addEventListener("click", () => {
        document.getElementById("result").textContent = "browser-ok";
      });
    </script>
  </body>
</html>
`,
    "utf8"
  );
}

async function smokeBrowser(browserType, launchOptions) {
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(`file://${testPagePath.replaceAll("\\", "/")}`);
    await page.getByRole("button", { name: "Run Probe" }).click();
    const resultText = await page.locator("#result").textContent();
    return {
      ok: resultText === "browser-ok",
      resultText
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  await writeTestPage();
  const result = {
    checkedAt: new Date().toISOString(),
    testPagePath,
    browsers: [],
    errors: []
  };

  let playwright;
  try {
    playwright = loadPlaywright();
  } catch (error) {
    result.errors.push(
      `Playwright failed to load: ${error instanceof Error ? error.message : String(error)}`
    );
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  const checks = [
    {
      name: "edge",
      type: playwright.chromium,
      launchOptions: { channel: "msedge", headless: true }
    },
    {
      name: "chrome",
      type: playwright.chromium,
      launchOptions: { channel: "chrome", headless: true }
    }
  ];

  for (const check of checks) {
    try {
      const smoke = await smokeBrowser(check.type, check.launchOptions);
      result.browsers.push({ name: check.name, ...smoke });
      if (!smoke.ok) {
        result.errors.push(`${check.name} did not produce expected browser-ok output.`);
      }
    } catch (error) {
      result.browsers.push({
        name: check.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
      result.errors.push(`${check.name} failed.`);
    }
  }

  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  if (result.errors.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

await main();
