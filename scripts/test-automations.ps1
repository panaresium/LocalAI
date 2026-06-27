Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone15"
$OutputPath = Join-Path $Artifacts "automations.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("artifacts/milestone15/automations.json");
const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/automation-manager.js")).href;
const { AutomationManager } = await import(managerModulePath);
const manager = new AutomationManager(path.resolve("."));
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function createScheduleAutomation() {
  return manager.createAutomation({
    name: "Daily status dry-run",
    purpose: "Prepare a notification summary when the desktop is unlocked.",
    trigger: {
      kind: "schedule",
      startAt: new Date(Date.now() + 60_000).toISOString(),
      timezone: "Asia/Bangkok",
      repeat: "daily"
    },
    action: {
      kind: "notify",
      target: "Studio notification center",
      instructions: "Create a dry-run notification only."
    },
    failurePolicy: {
      retryCount: 1,
      disableAfterFailures: 2,
      timeoutSeconds: 60,
      notifyOnFailure: true
    }
  });
}

let state = manager.getState();
check(state.policy.milestone === 15, "Automation policy milestone is not 15.");
check(state.policy.desktopUnlockedRequired === true, "Desktop-unlocked policy missing.");
check(state.policy.unattendedOsInputAllowed === false, "Unattended OS input must be blocked.");
check(state.policy.hiddenBackgroundWatchersAllowed === false, "Hidden watchers must be blocked.");
check(state.policy.broadFilesystemTriggersAllowed === false, "Broad filesystem triggers must be blocked.");
check(state.policy.requiresApproval === true, "Automation approval must be required.");
check(state.policy.dryRunOnly === true, "Milestone 15 automations must be dry-run only.");

state = createScheduleAutomation();
const scheduled = state.automations[0];
check(scheduled.status === "draft", "Created schedule automation should be draft.");
check(scheduled.trigger.kind === "schedule", "Schedule trigger was not recorded.");
check(scheduled.requiresDesktopUnlocked === true, "Automation should require unlocked desktop.");
check(scheduled.dryRunOnly === true, "Automation definition should be dry-run only.");

state = manager.reviewAutomation({
  automationId: scheduled.id,
  decision: "approve",
  reviewNote: "Approved validation schedule."
});
check(state.automations[0]?.status === "approved", "Schedule automation was not approved.");

state = manager.simulateAutomation({
  automationId: scheduled.id,
  triggerKind: "schedule",
  desktopUnlocked: true
});
check(state.runs[0]?.status === "dry-run-completed", "Approved schedule automation did not complete dry-run.");
check(state.runs[0]?.dryRunOnly === true, "Run should be dry-run only.");

state = manager.createAutomation({
  name: "Status file watcher dry-run",
  purpose: "Observe a specific project status file change.",
  trigger: {
    kind: "file-change",
    path: path.resolve("STATUS.md"),
    event: "changed",
    recursive: false
  },
  action: {
    kind: "knowledge-refresh-dry-run",
    target: "Local project knowledge index",
    instructions: "Plan a local refresh only."
  },
  failurePolicy: {
    retryCount: 1,
    disableAfterFailures: 2,
    timeoutSeconds: 60,
    notifyOnFailure: true
  }
});
const fileAutomation = state.automations[0];
check(fileAutomation.trigger.kind === "file-change", "File trigger was not recorded.");
state = manager.reviewAutomation({
  automationId: fileAutomation.id,
  decision: "approve",
  reviewNote: "Approved exact file trigger."
});
state = manager.simulateAutomation({
  automationId: fileAutomation.id,
  triggerKind: "file-change",
  desktopUnlocked: false
});
check(state.runs[0]?.status === "blocked", "Locked desktop should block automation dry-run.");
check(state.runs[0]?.failureReason?.includes("Desktop"), "Desktop block reason missing.");

try {
  manager.createAutomation({
    name: "Broad root watcher",
    purpose: "Watch a broad drive root.",
    trigger: {
      kind: "file-change",
      path: path.parse(process.cwd()).root,
      event: "changed",
      recursive: false
    },
    action: {
      kind: "notify",
      target: "Studio notification center",
      instructions: "Create a notification."
    },
    failurePolicy: {
      retryCount: 0,
      disableAfterFailures: 1,
      timeoutSeconds: 30,
      notifyOnFailure: true
    }
  });
  errors.push("Broad filesystem trigger was not rejected.");
} catch (error) {
  check(String(error.message || error).includes("Broad") || String(error.message || error).includes("specific"), "Unexpected broad trigger error.");
}

try {
  manager.createAutomation({
    name: "Credential entry",
    purpose: "Enter password into a login prompt.",
    trigger: { kind: "manual" },
    action: {
      kind: "teach-replay-dry-run",
      target: "Login prompt",
      instructions: "Use password credential."
    },
    failurePolicy: {
      retryCount: 0,
      disableAfterFailures: 1,
      timeoutSeconds: 30,
      notifyOnFailure: true
    }
  });
  errors.push("Sensitive automation content was not rejected.");
} catch (error) {
  check(String(error.message || error).includes("Sensitive"), "Unexpected sensitive automation error.");
}

state = manager.createAutomation({
  name: "Failure threshold dry-run",
  purpose: "Validate failure handling.",
  trigger: { kind: "manual" },
  action: {
    kind: "notify",
    target: "Studio notification center",
    instructions: "Create a dry-run notification."
  },
  failurePolicy: {
    retryCount: 1,
    disableAfterFailures: 2,
    timeoutSeconds: 30,
    notifyOnFailure: true
  }
});
const failureAutomation = state.automations[0];
state = manager.reviewAutomation({
  automationId: failureAutomation.id,
  decision: "approve",
  reviewNote: "Approved failure validation."
});
state = manager.simulateAutomation({
  automationId: failureAutomation.id,
  triggerKind: "manual",
  desktopUnlocked: true,
  forceFailure: true
});
check(state.automations[0]?.failureCount === 1, "First forced failure did not increment failure count.");
check(state.runs[0]?.nextRetryAt !== null, "Retry was not scheduled within retry policy.");
state = manager.simulateAutomation({
  automationId: failureAutomation.id,
  triggerKind: "manual",
  desktopUnlocked: true,
  forceFailure: true
});
check(state.automations[0]?.status === "disabled", "Failure threshold did not disable automation.");
check(state.automations[0]?.failureCount === 2, "Second forced failure count mismatch.");
check(state.audit.some((event) => event.kind === "automation.disabled"), "Failure-disable audit event missing.");

const result = {
  checkedAt: new Date().toISOString(),
  policy: state.policy,
  automations: state.automations,
  runs: state.runs,
  audit: state.audit,
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
            errors = @("Automation validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
