Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux31"
$OutputPath = Join-Path $Artifacts "command-review-decision-prompt.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux31/command-review-decision-prompt.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandReviewDecisionPrompt");
const functionEnd = appSource.indexOf("function summarizeCommandDecision", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const impactIndex = appSource.indexOf('aria-label="Command approval impact"');
const promptIndex = appSource.indexOf('aria-label="Command review decision prompt"');
const checklistIndex = appSource.indexOf('aria-label="Command approval checklist"');

check(appSource.includes('type CommandReviewDecisionPromptTone = "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed decision prompt tones.");
check(appSource.includes("type CommandReviewDecisionPrompt"), "Renderer must define decision prompt shape.");
check(appSource.includes("readonly headline: string"), "Decision prompt must include headline.");
check(appSource.includes("readonly action: string"), "Decision prompt must include action.");
check(appSource.includes("readonly guard: string"), "Decision prompt must include guard.");
check(appSource.includes('function buildCommandReviewDecisionPrompt('), "Renderer must define decision prompt helper.");
check(appSource.includes("): CommandReviewDecisionPrompt"), "Decision prompt helper must return typed prompt.");
check(functionBlock.includes('headline: "Revise before approval"'), "Decision prompt must cover blocked plans.");
check(functionBlock.includes('action: hasReviewNote ? "Use note for revision" : "Add review note"'), "Decision prompt must use review note state for blocked plans.");
check(functionBlock.includes('guard: "Approve disabled"'), "Decision prompt must explain blocked approval.");
check(functionBlock.includes('headline: "Ready to open"'), "Decision prompt must cover approved plans.");
check(functionBlock.includes('guard: "User-controlled handoff"'), "Decision prompt must preserve user-controlled handoff.");
check(functionBlock.includes('headline: "Plan rejected"'), "Decision prompt must cover rejected plans.");
check(functionBlock.includes('action: "Create a revision"'), "Decision prompt must guide rejected revisions.");
check(functionBlock.includes('headline: "Approval policy unavailable"'), "Decision prompt must cover approval policy gaps.");
check(functionBlock.includes('guard: "No handoff"'), "Decision prompt must block handoff when policy is unavailable.");
check(functionBlock.includes('headline: hasReviewNote ? "Decision ready with note" : "Decision ready"'), "Decision prompt must cover ready draft decisions.");
check(functionBlock.includes('action: "Approve or reject"'), "Decision prompt must make the explicit decision clear.");
check(!functionBlock.includes("createCommandPlan("), "Decision prompt helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Decision prompt helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Decision prompt helper must not open a workspace.");
check(appSource.includes("const selectedCommandDecisionPrompt = selectedCommandPlan"), "Renderer must derive selected decision prompt.");
check(appSource.includes("buildCommandReviewDecisionPrompt(selectedCommandPlan, commandReviewNote, commandPolicy)"), "Renderer must derive prompt from selected plan, review note, and policy.");
check(appSource.includes('aria-label="Command review decision prompt"'), "Decision prompt must be accessible.");
check(appSource.includes("selectedCommandDecisionPrompt.action"), "Renderer must render decision prompt action.");
check(appSource.includes("selectedCommandDecisionPrompt.guard"), "Renderer must render decision prompt guard.");
check(impactIndex >= 0 && promptIndex > impactIndex, "Decision prompt must render after approval impact.");
check(promptIndex >= 0 && checklistIndex > promptIndex, "Decision prompt must render before approval checklist.");
check(styleSource.includes(".command-review-decision-prompt"), "Decision prompt CSS missing.");
check(styleSource.includes(".command-review-decision-prompt.ready"), "Ready decision prompt CSS missing.");
check(styleSource.includes(".command-review-decision-prompt.blocked"), "Blocked decision prompt CSS missing.");
check(styleSource.includes(".command-review-decision-prompt.approved"), "Approved decision prompt CSS missing.");
check(styleSource.includes(".command-review-decision-prompt.rejected"), "Rejected decision prompt CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["ready", "blocked", "approved", "rejected"],
  fields: ["headline", "detail", "action", "guard"],
  displayOnly: true,
  approvalUnchanged: true,
  errors
};
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
'@

$output = $nodeScript | node --input-type=module 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path -LiteralPath $OutputPath)) {
        [ordered]@{
            checkedAt = (Get-Date).ToString("o")
            errors = @("Command review decision prompt validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
