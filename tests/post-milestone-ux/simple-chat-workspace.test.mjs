import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rendererSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Renderer exposes Chat as its own workspace route", () => {
  assert.match(rendererSource, /type WorkspaceId = "chat" \| "command"/);
  assert.match(rendererSource, /\{ id: "chat", label: "Chat" \}/);
  assert.match(rendererSource, /chat: "Simple conversation with Hermes\."/);
  assert.match(rendererSource, /if \(route === "chat"\) \{\s*return "chat";\s*\}/);
  assert.match(rendererSource, /if \(route === "profile-config"\) \{\s*return "admin";\s*\}/);
  assert.match(rendererSource, /id: "chat",\s*label: "Chat",\s*command: "Draft a concise local project status answer",\s*workspace: "chat"/);
  assert.match(rendererSource, /chat: messages\.length \|\| \(chatState\?\.sessions\.length \?\? 0\)/);
});

test("Chat workspace hides global configuration summaries", () => {
  assert.match(rendererSource, /\{activeWorkspace !== "chat" \? \(\s*<section className="summary-grid">/);
  assert.match(rendererSource, /admin: "Profiles, models, projects, and local configuration\."/);
  assert.doesNotMatch(rendererSource, /admin: "Profiles, models, chat sessions/);
});

test("Chat workspace is a simple input-only surface", () => {
  const chatBlock = sourceBetween(
    rendererSource,
    '<section className="chat-workspace" aria-label="Simple chat">',
    '<section className="admin-workspace" aria-label="Profiles projects and config">'
  );

  assert.match(chatBlock, /className="chat-panel simple-chat-panel"/);
  assert.match(chatBlock, /className="message-list simple-message-list"/);
  assert.match(chatBlock, /Type what you want Hermes to do\./);
  assert.match(chatBlock, /className="composer simple-composer" aria-label="Simple chat composer"/);
  assert.match(chatBlock, /aria-label="Chat message"/);
  assert.match(chatBlock, /placeholder="Type what you want\.\.\."/);
  assert.match(chatBlock, /onClick=\{\(\) => void sendMessage\(\)\}/);
  assert.match(chatBlock, /Send\s*<\/button>/);
  assert.doesNotMatch(chatBlock, /chat-toolbar|<select|selectChatAttachments|Attach|Tool Timeline|timeline-panel|Profile|Session/);
});

test("CSS isolates Chat from Admin and other workspaces", () => {
  const chatVisibilityBlock = sourceBetween(
    styleSource,
    ".studio-shell.workspace-chat :is(",
    ".studio-shell.workspace-command :is("
  );
  const adminVisibilityBlock = sourceBetween(
    styleSource,
    ".studio-shell.workspace-admin :is(",
    ".studio-shell.workspace-services :is("
  );

  assert.match(styleSource, /\.chat-workspace \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 360px\);/);
  assert.match(styleSource, /\.chat-thinking-sidebar/);
  assert.match(styleSource, /\.simple-chat-panel/);
  assert.match(styleSource, /\.simple-message-list/);
  assert.match(styleSource, /\.simple-composer/);
  assert.match(chatVisibilityBlock, /\.admin-workspace/);
  assert.doesNotMatch(chatVisibilityBlock, /\.chat-workspace/);
  assert.match(adminVisibilityBlock, /\.chat-workspace/);
});

test("Simple chat workspace validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-simple-chat-workspace.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux39.ps1"), true);
  assert.equal(pkg.scripts["test:simple-chat-workspace"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-simple-chat-workspace.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux39"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux39.ps1");
});
