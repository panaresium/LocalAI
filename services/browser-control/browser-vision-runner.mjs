import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "milestone9", "browser-vision");
const pagePath = path.join(artifactsDir, "controlled-browser-page.html");
const LOW_CONFIDENCE_THRESHOLD = 0.72;

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

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = new Map();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      options.set(token, "true");
    } else {
      options.set(token, value);
      index += 1;
    }
  }

  return {
    command,
    engine: normalizeEngine(options.get("--engine") ?? "edge"),
    query: String(options.get("--query") ?? ""),
    outputPath: options.has("--output") ? path.resolve(String(options.get("--output"))) : null
  };
}

function normalizeEngine(value) {
  if (value !== "edge" && value !== "chrome") {
    throw new Error("Browser engine must be edge or chrome.");
  }
  return value;
}

async function writeControlledPage() {
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(pagePath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Hermes Browser Vision Probe</title>
    <style>
      :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; }
      body { margin: 0; background: #f6f8fa; color: #1d232a; }
      main { width: 860px; margin: 30px auto; }
      header { margin-bottom: 18px; }
      h1 { margin: 0; font-size: 28px; }
      p { color: #5d6874; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .tile { border: 1px solid #d8dee4; border-radius: 8px; background: #fff; padding: 16px; min-height: 138px; }
      button, input { font: inherit; border: 1px solid #9aa7b4; border-radius: 6px; min-height: 36px; padding: 0 12px; }
      button { background: #fff; }
      .primary { border-color: #2368a2; color: #0b5ca5; }
      .visual-target { display: grid; place-items: center; height: 96px; border: 2px dashed #7a8794; border-radius: 8px; background: #fbfcfd; font-weight: 650; }
      output { display: block; margin-top: 10px; color: #166534; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Hermes Browser Vision Probe</h1>
        <p>Controlled local page for DOM automation, screenshot grounding, and overlay verification.</p>
      </header>
      <section class="grid">
        <article class="tile">
          <h2>DOM Target</h2>
          <button class="primary" data-testid="run-probe">Run Browser Probe</button>
          <output id="probe-result">idle</output>
        </article>
        <article class="tile">
          <h2>Search</h2>
          <label>
            <span>Query field</span>
            <input data-testid="query-input" aria-label="Query field" value="local browser grounding" />
          </label>
        </article>
        <article class="tile">
          <h2>Visual Target</h2>
          <div class="visual-target" data-visual-label="Fallback Visual Tile">Fallback Visual Tile</div>
        </article>
      </section>
    </main>
    <script>
      document.querySelector('[data-testid="run-probe"]').addEventListener("click", () => {
        document.getElementById("probe-result").textContent = "browser-vision-ok";
      });
    </script>
  </body>
</html>
`, "utf8");
}

async function withPage(engine, callback) {
  const playwright = loadPlaywright();
  const userDataDir = path.join(artifactsDir, `profile-${engine}-${Date.now()}`);
  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    channel: engine === "edge" ? "msedge" : "chrome",
    headless: true,
    viewport: { width: 960, height: 620 }
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(pathToFileURL(pagePath).href);
    return await callback(page);
  } finally {
    await context.close();
  }
}

async function collectElements(page, query) {
  const rawElements = await page.locator("button, input, [data-visual-label], h1, h2").evaluateAll((nodes, threshold) => nodes.map((node, index) => {
    const rect = node.getBoundingClientRect();
    const element = node;
    const text = (element.getAttribute("aria-label") || element.getAttribute("data-visual-label") || element.textContent || element.getAttribute("value") || "").trim();
    const tagName = element.tagName.toLowerCase();
    const role = tagName === "button"
      ? "button"
      : tagName === "input"
        ? "textbox"
        : element.hasAttribute("data-visual-label")
          ? "visual"
          : "text";
    const selector = element.getAttribute("data-testid")
      ? `[data-testid="${element.getAttribute("data-testid")}"]`
      : element.getAttribute("data-visual-label")
        ? `[data-visual-label="${element.getAttribute("data-visual-label")}"]`
        : `${tagName}:nth-of-type(${index + 1})`;
    const queryText = String(threshold || "").toLowerCase();
    const haystack = `${text} ${role} ${selector}`.toLowerCase();
    let confidence = queryText.length === 0 ? 0.55 : 0.42;
    if (queryText && haystack.includes(queryText)) {
      confidence = 0.96;
    } else if (queryText && queryText.split(/\s+/).some((part) => part.length > 2 && haystack.includes(part))) {
      confidence = 0.76;
    } else if (role === "visual") {
      confidence = 0.58;
    }
    const source = role === "visual" && confidence < 0.72 ? "vision-fallback" : "dom";
    return {
      id: `browser-candidate-${index + 1}`,
      selector,
      role,
      text,
      bounds: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      confidence,
      confidenceLabel: confidence >= 0.85 ? "high" : confidence >= 0.72 ? "medium" : "low",
      source,
      requiresApproval: confidence < 0.72
    };
  }), query);

  return rawElements
    .filter((element) => element.bounds.width > 0 && element.bounds.height > 0)
    .sort((left, right) => right.confidence - left.confidence);
}

async function addOverlay(page, candidates) {
  await page.evaluate((items) => {
    document.querySelectorAll("[data-hermes-overlay]").forEach((node) => node.remove());
    for (const item of items) {
      const box = document.createElement("div");
      box.setAttribute("data-hermes-overlay", "true");
      box.style.position = "fixed";
      box.style.left = `${item.bounds.left}px`;
      box.style.top = `${item.bounds.top}px`;
      box.style.width = `${item.bounds.width}px`;
      box.style.height = `${item.bounds.height}px`;
      box.style.border = `3px solid ${item.requiresApproval ? "#c2413d" : "#1d7f4c"}`;
      box.style.borderRadius = "8px";
      box.style.pointerEvents = "none";
      box.style.zIndex = "2147483647";
      const label = document.createElement("div");
      label.textContent = `${item.id} ${Math.round(item.confidence * 100)}%`;
      label.style.position = "absolute";
      label.style.left = "0";
      label.style.top = "-24px";
      label.style.background = item.requiresApproval ? "#fee2e2" : "#dcfce7";
      label.style.color = item.requiresApproval ? "#991b1b" : "#166534";
      label.style.font = "12px Segoe UI, Arial, sans-serif";
      label.style.padding = "2px 6px";
      label.style.borderRadius = "6px";
      box.append(label);
      document.body.append(box);
    }
  }, candidates.slice(0, 3));
}

async function runInspect(engine) {
  await writeControlledPage();
  return withPage(engine, async (page) => {
    const screenshotPath = path.join(artifactsDir, `inspect-${engine}-${Date.now()}.png`);
    const elements = await collectElements(page, "");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return {
      command: "browser.inspect",
      engine,
      inspectedAt: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      screenshotPath,
      screenshotUrl: pathToFileURL(screenshotPath).href,
      elements
    };
  });
}

async function runGround(engine, query) {
  if (!query.trim()) {
    throw new Error("Grounding query is required.");
  }
  await writeControlledPage();
  return withPage(engine, async (page) => {
    const screenshotPath = path.join(artifactsDir, `ground-${engine}-${Date.now()}.png`);
    const overlayPath = path.join(artifactsDir, `overlay-${engine}-${Date.now()}.png`);
    const candidates = (await collectElements(page, query)).slice(0, 6);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await addOverlay(page, candidates);
    await page.screenshot({ path: overlayPath, fullPage: true });
    const selected = candidates[0] ?? null;
    return {
      command: "browser.ground",
      engine,
      groundedAt: new Date().toISOString(),
      query,
      screenshotPath,
      screenshotUrl: pathToFileURL(screenshotPath).href,
      overlayPath,
      overlayUrl: pathToFileURL(overlayPath).href,
      candidates,
      selectedCandidateId: selected?.id ?? null,
      requiresApproval: Boolean(selected && selected.confidence < LOW_CONFIDENCE_THRESHOLD)
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  if (args.command === "inspect") {
    result = await runInspect(args.engine);
  } else if (args.command === "ground") {
    result = await runGround(args.engine, args.query);
  } else {
    throw new Error("Usage: browser-vision-runner.mjs <inspect|ground> --engine <edge|chrome> [--query text] [--output path]");
  }

  if (args.outputPath) {
    await fs.mkdir(path.dirname(args.outputPath), { recursive: true });
    await fs.writeFile(args.outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(result, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
}
