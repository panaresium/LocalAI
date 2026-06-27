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

test("Chat page renders a dedicated right-side thinking panel", () => {
  const chatBlock = sourceBetween(
    rendererSource,
    '<section className="chat-workspace" aria-label="Simple chat">',
    '<section className="admin-workspace" aria-label="Profiles projects and config">'
  );
  const messageBlock = sourceBetween(
    chatBlock,
    "{messages.map((message) => (",
    '<div className="composer simple-composer" aria-label="Simple chat composer">'
  );

  assert.match(chatBlock, /<aside className="chat-thinking-sidebar thinking-trace" aria-label="Chat thinking side panel">/);
  assert.match(chatBlock, /<h2>AI Process<\/h2>/);
  assert.match(chatBlock, /AI side panel response metrics/);
  assert.match(chatBlock, /AI thinking steps diagram/);
  assert.match(chatBlock, /AI step by step process/);
  assert.match(chatBlock, /Recent Activity/);
  assert.doesNotMatch(messageBlock, /className="thinking-trace"|AI process|thinking-diagram|thinking-steps/);
});

test("Chat thinking sidebar derives live speed and step state from the active run", () => {
  assert.match(rendererSource, /const \[activeChatRunStartedAt, setActiveChatRunStartedAt\] = useState<number \| null>\(null\)/);
  assert.match(rendererSource, /const \[chatNow, setChatNow\] = useState\(Date\.now\(\)\)/);
  assert.match(rendererSource, /event\.type === "runStarted"/);
  assert.match(rendererSource, /setActiveChatRunStartedAt\(Date\.now\(\)\)/);
  assert.match(rendererSource, /setChatNow\(Date\.now\(\)\)/);
  assert.match(rendererSource, /window\.setInterval\(\(\) => \{\s*setChatNow\(Date\.now\(\)\);\s*\}, 1000\)/);
  assert.match(rendererSource, /const liveChatTokensPerSecond = isChatRunning/);
  assert.match(rendererSource, /estimateVisibleChatTokens\(pendingAssistantMessage\?\.content \?\? ""\)/);
  assert.match(rendererSource, /buildLiveThinkingSteps\(liveChatOutputTokens > 0, activeChatMaxTurns\)/);
});

test("Chat thinking sidebar has responsive two-column layout and activity styling", () => {
  assert.match(styleSource, /\.chat-workspace \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 360px\);/);
  assert.match(styleSource, /\.chat-thinking-sidebar/);
  assert.match(styleSource, /position: sticky/);
  assert.match(styleSource, /\.thinking-activity/);
  assert.match(styleSource, /@media \(max-width: 980px\)/);
  assert.match(styleSource, /\.chat-workspace \{\s*grid-template-columns: minmax\(0, 1fr\);/);
});

test("Chat thinking sidebar validation scripts are registered", () => {
  assert.equal(fs.existsSync("scripts/test-chat-thinking-sidebar.ps1"), true);
  assert.equal(fs.existsSync("scripts/run-post-milestone-ux41.ps1"), true);
  assert.equal(pkg.scripts["test:chat-thinking-sidebar"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-chat-thinking-sidebar.ps1");
  assert.equal(pkg.scripts["test:post-milestone-ux41"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-post-milestone-ux41.ps1");
});
