Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux10"
$OutputPath = Join-Path $Artifacts "command-approval-trail.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux10/command-approval-trail.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const contractSource = fs.readFileSync("packages/contracts/src/command-center.ts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(contractSource.includes("readonly createdAt: string"), "Command plan contract must keep createdAt.");
check(contractSource.includes("readonly reviewedAt: string | null"), "Command plan contract must keep reviewedAt.");
check(contractSource.includes("readonly reviewNote: string | null"), "Command plan contract must keep reviewNote.");
check(appSource.includes('type CommandApprovalTrailTone = "created" | "pending" | "approved" | "rejected"'), "Renderer must define typed approval trail tones.");
check(appSource.includes("type CommandApprovalTrailItem"), "Renderer must define approval trail item shape.");
check(appSource.includes("function formatCommandTimestamp(value: string): string"), "Renderer must format command timestamps.");
check(appSource.includes("function buildCommandApprovalTrail(plan: CommandPlan): readonly CommandApprovalTrailItem[]"), "Renderer must build command approval trail locally.");
check(appSource.includes("detail: formatCommandTimestamp(plan.createdAt)"), "Approval trail must render plan creation time.");
check(appSource.includes("if (!plan.reviewedAt)"), "Approval trail must include pending review state.");
check(appSource.includes('label: "Awaiting review"'), "Approval trail must label pending review.");
check(appSource.includes("Blocked plans cannot be approved"), "Approval trail must explain blocked pending plans.");
check(appSource.includes("detail: formatCommandTimestamp(plan.reviewedAt)"), "Approval trail must render review time.");
check(appSource.includes('note: plan.reviewNote ?? "No review note."'), "Approval trail must render review notes.");
check(appSource.includes("const selectedCommandApprovalTrail = selectedCommandPlan ? buildCommandApprovalTrail(selectedCommandPlan) : []"), "Renderer must derive selected approval trail.");
check(appSource.includes('className="command-approval-trail"'), "Renderer must render approval trail.");
check(appSource.includes('aria-label="Command approval trail"'), "Approval trail must be accessible.");
check(appSource.includes("selectedCommandApprovalTrail.map"), "Approval trail must render all items.");
check(appSource.includes("className={item.tone}"), "Approval trail items must expose state class.");
check(!appSource.includes("buildCommandApprovalTrail(selectedCommandPlan.id"), "Approval trail must not review or mutate plans.");
check(styleSource.includes(".command-approval-trail"), "Approval trail CSS missing.");
check(styleSource.includes(".command-approval-trail li.pending"), "Pending trail CSS missing.");
check(styleSource.includes(".command-approval-trail li.approved"), "Approved trail CSS missing.");
check(styleSource.includes(".command-approval-trail li.rejected"), "Rejected trail CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Approval trail must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  trailStates: ["created", "pending", "approved", "rejected"],
  localOnly: true,
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
            errors = @("Command approval trail validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
