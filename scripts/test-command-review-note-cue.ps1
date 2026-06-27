Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux32"
$OutputPath = Join-Path $Artifacts "command-review-note-cue.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux32/command-review-note-cue.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandReviewNoteCue");
const functionEnd = appSource.indexOf("function summarizeCommandDecision", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const noteIndex = appSource.indexOf('className="text-field command-review-note"');
const cueIndex = appSource.indexOf('aria-label="Command review note cue"');
const revisionIndex = appSource.indexOf('aria-label="Command revision draft"');

check(appSource.includes('type CommandReviewNoteCueTone = "idle" | "ready" | "blocked" | "locked"'), "Renderer must define typed review note cue tones.");
check(appSource.includes("type CommandReviewNoteCue"), "Renderer must define review note cue shape.");
check(appSource.includes("readonly suggestion: string"), "Review note cue must include suggestion.");
check(appSource.includes("readonly guard: string"), "Review note cue must include guard.");
check(appSource.includes("readonly characterCount: number"), "Review note cue must include character count.");
check(appSource.includes("function buildCommandReviewNoteCue("), "Renderer must define review note cue helper.");
check(appSource.includes("): CommandReviewNoteCue"), "Review note cue helper must return typed cue.");
check(functionBlock.includes('label: "Review closed"'), "Review note cue must cover approved plans.");
check(functionBlock.includes('guard: "Note locked"'), "Review note cue must lock closed review notes.");
check(functionBlock.includes('label: "Revision source"'), "Review note cue must cover rejected plans.");
check(functionBlock.includes('suggestion: "Use revision draft for feedback"'), "Review note cue must guide rejected plan revision.");
check(functionBlock.includes('label: trimmedReviewNote ? "Revision note ready" : "Add blocker feedback"'), "Review note cue must cover blocked draft note state.");
check(functionBlock.includes('guard: "Approve disabled"'), "Review note cue must preserve blocked approval.");
check(functionBlock.includes('label: "Decision note ready"'), "Review note cue must cover ready drafts with a note.");
check(functionBlock.includes('guard: "Handoff still approval-gated"'), "Review note cue must keep handoff gated for ready drafts.");
check(functionBlock.includes('label: "Optional note"'), "Review note cue must cover draft plans without a note.");
check(functionBlock.includes('guard: "No handoff before approval"'), "Review note cue must preserve approval-before-handoff guidance.");
check(!functionBlock.includes("createCommandPlan("), "Review note cue helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Review note cue helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Review note cue helper must not open a workspace.");
check(appSource.includes("const selectedCommandReviewNoteCue = selectedCommandPlan"), "Renderer must derive selected review note cue.");
check(appSource.includes("buildCommandReviewNoteCue(selectedCommandPlan, commandReviewNote)"), "Renderer must derive cue from selected plan and note.");
check(appSource.includes('aria-label="Command review note cue"'), "Review note cue must be accessible.");
check(appSource.includes("selectedCommandReviewNoteCue.suggestion"), "Renderer must render review note cue suggestion.");
check(appSource.includes("selectedCommandReviewNoteCue.guard"), "Renderer must render review note cue guard.");
check(appSource.includes("selectedCommandReviewNoteCue.characterCount"), "Renderer must render review note character count.");
check(noteIndex >= 0 && cueIndex > noteIndex, "Review note cue must render after review note entry.");
check(cueIndex >= 0 && revisionIndex > cueIndex, "Review note cue must render before revision draft.");
check(styleSource.includes(".command-review-note-cue"), "Review note cue CSS missing.");
check(styleSource.includes(".command-review-note-cue.idle"), "Idle review note cue CSS missing.");
check(styleSource.includes(".command-review-note-cue.ready"), "Ready review note cue CSS missing.");
check(styleSource.includes(".command-review-note-cue.blocked"), "Blocked review note cue CSS missing.");
check(styleSource.includes(".command-review-note-cue.locked"), "Locked review note cue CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["idle", "ready", "blocked", "locked"],
  fields: ["label", "detail", "suggestion", "guard", "characterCount"],
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
            errors = @("Command review note cue validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
