Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux34"
$OutputPath = Join-Path $Artifacts "command-focus-actions.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux34/command-focus-actions.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const helperStart = appSource.indexOf("function buildCommandFocusActions");
const helperEnd = appSource.indexOf("function pluralize", helperStart);
const helperBlock = helperStart >= 0 && helperEnd > helperStart ? appSource.slice(helperStart, helperEnd) : "";
const handlerStart = appSource.indexOf("function handleCommandFocusAction");
const handlerEnd = appSource.indexOf("useEffect(", handlerStart);
const handlerBlock = handlerStart >= 0 && handlerEnd > handlerStart ? appSource.slice(handlerStart, handlerEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const focusIndex = appSource.indexOf('aria-label="Command focus bar"');
const actionsIndex = appSource.indexOf('aria-label="Command focus actions"');
const panelIndex = appSource.indexOf('className="command-panel"');

check(appSource.includes('type CommandFocusActionId = "make-plan" | "review-plan" | "use-revision" | "open-handoff"'), "Renderer must define typed command focus action ids.");
check(appSource.includes('type CommandFocusActionTone = "primary" | "secondary" | "blocked" | "handoff"'), "Renderer must define typed command focus action tones.");
check(appSource.includes("type CommandFocusAction"), "Renderer must define command focus action shape.");
check(appSource.includes("readonly disabled: boolean"), "Focus action must include disabled state.");
check(appSource.includes("readonly guard: string"), "Focus action must include guard.");
check(appSource.includes("function findCommandReviewTargetPlan(plans: readonly CommandPlan[]): CommandPlan | null"), "Renderer must define review target helper.");
check(appSource.includes('plans.find((plan) => plan.status === "draft" && plan.blockedReasons.length === 0)'), "Review target must prioritize ready drafts.");
check(appSource.includes('plans.find((plan) => plan.status === "draft" && plan.blockedReasons.length > 0)'), "Review target must include blocked drafts.");
check(appSource.includes('plans.find((plan) => plan.status === "approved")'), "Review target must include approved handoffs.");
check(appSource.includes("function buildCommandFocusActions("), "Renderer must define focus actions helper.");
check(appSource.includes("): readonly CommandFocusAction[]"), "Focus actions helper must return typed actions.");
check(helperBlock.includes('id: "make-plan"'), "Focus actions must include Make Plan.");
check(helperBlock.includes("disabled: !composerBrief.canPlan"), "Make Plan action must respect composer readiness.");
check(helperBlock.includes('id: "review-plan"'), "Focus actions must include Review Plan.");
check(helperBlock.includes('guard: reviewTargetPlan ? "Selects plan only" : "No plan"'), "Review Plan action must select only.");
check(helperBlock.includes('id: "use-revision"'), "Focus actions must include Use Revision.");
check(helperBlock.includes('guard: "No plan created"'), "Use Revision action must not create a plan.");
check(helperBlock.includes('id: "open-handoff"'), "Focus actions must include Open Handoff.");
check(helperBlock.includes("disabled: !approvedHandoff"), "Open Handoff action must require approval.");
check(!helperBlock.includes("createCommandPlan("), "Focus action helper must not create a plan.");
check(!helperBlock.includes("reviewCommandPlan("), "Focus action helper must not approve or reject a plan.");
check(!helperBlock.includes("setActiveWorkspace("), "Focus action helper must not open a workspace.");
check(appSource.includes("const commandFocusActions = buildCommandFocusActions("), "Renderer must derive focus actions.");
check(appSource.includes("commandReviewTargetPlan"), "Renderer must derive actions from the prioritized review target.");
check(appSource.includes('aria-label="Command focus actions"'), "Focus actions must be accessible.");
check(appSource.includes("commandFocusActions.map((action) =>"), "Renderer must render focus actions.");
check(appSource.includes("disabled={action.disabled}"), "Focus action buttons must use derived disabled state.");
check(appSource.includes("onClick={() => handleCommandFocusAction(action.id)}"), "Focus action buttons must use explicit click handler.");
check(focusIndex >= 0 && actionsIndex > focusIndex, "Focus actions must render inside focus bar.");
check(actionsIndex >= 0 && panelIndex > actionsIndex, "Focus actions must render before the command panel.");
check(handlerBlock.includes("function handleCommandFocusAction(actionId: CommandFocusActionId): void"), "Renderer must define typed focus action handler.");
check(handlerBlock.includes('actionId === "make-plan"'), "Focus handler must handle Make Plan.");
check(handlerBlock.includes("void createCommandPlan()"), "Make Plan action must call explicit plan creation.");
check(handlerBlock.includes('actionId === "review-plan"'), "Focus handler must handle Review Plan.");
check(handlerBlock.includes("findCommandReviewTargetPlan(commandCenterState?.plans ?? [])"), "Review Plan action must use prioritized target.");
check(handlerBlock.includes('setCommandPlanFilter("all")'), "Review Plan action must reveal selected target.");
check(handlerBlock.includes("setSelectedCommandPlanId(reviewTargetPlan.id)"), "Review Plan action must select target.");
check(handlerBlock.includes('actionId === "use-revision"'), "Focus handler must handle revision draft.");
check(handlerBlock.includes("useCommandRevisionDraft(selectedCommandPlan)"), "Use Revision action must reuse revision helper.");
check(handlerBlock.includes('actionId === "open-handoff"'), "Focus handler must handle handoff.");
check(handlerBlock.includes('selectedCommandPlan?.status !== "approved"'), "Open Handoff action must require approved plan.");
check(handlerBlock.includes("setActiveWorkspace(nextWorkspace)"), "Open Handoff action must only run after approved guard.");
check(!handlerBlock.includes("reviewCommandPlan("), "Focus action handler must not approve or reject plans.");
check(styleSource.includes(".command-focus-bar .command-focus-actions"), "Focus actions CSS missing.");
check(styleSource.includes("repeat(auto-fit, minmax(128px, 1fr))"), "Focus actions must use responsive grid.");
check(styleSource.includes(".command-focus-actions button.primary"), "Primary focus action CSS missing.");
check(styleSource.includes(".command-focus-actions button.secondary"), "Secondary focus action CSS missing.");
check(styleSource.includes(".command-focus-actions button.blocked"), "Blocked focus action CSS missing.");
check(styleSource.includes(".command-focus-actions button.handoff"), "Handoff focus action CSS missing.");
check(styleSource.includes(".command-focus-actions button:disabled"), "Disabled focus action CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  actions: ["make-plan", "review-plan", "use-revision", "open-handoff"],
  displayOnlyHelpers: true,
  explicitClicksOnly: true,
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
            errors = @("Command focus actions validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
