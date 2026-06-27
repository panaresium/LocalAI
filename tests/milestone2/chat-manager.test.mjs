import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const chatManagerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/chat-manager.js")).href;

test("Hermes chat args are local, quiet, bounded, and do not auto-approve", async () => {
  const { buildHermesChatArgs } = await import(chatManagerModulePath);
  const args = buildHermesChatArgs({
    prompt: "hello",
    provider: "custom",
    model: "qwen3.5:4b",
    maxTurns: 6,
    sessionId: "20260626_120000_abcdef",
    imagePath: "D:\\LocalAI\\sample.png"
  });

  assert.deepEqual(args.slice(0, 8), ["chat", "-Q", "--source", "studio", "--provider", "custom", "--model", "qwen3.5:4b"]);
  assert.equal(args.includes("--max-turns"), true);
  assert.equal(args.includes("--resume"), true);
  assert.equal(args.includes("--image"), true);
  assert.equal(args.includes("-q"), true);
  assert.equal(args.includes("--yolo"), false);
  assert.equal(args.includes("--accept-hooks"), false);
  assert.equal(args.includes("--worktree"), false);
});

test("Hermes quiet output parser separates response text and session id", async () => {
  const { parseHermesChatOutput } = await import(chatManagerModulePath);
  const parsed = parseHermesChatOutput("hello from hermes\r\n\r\nsession_id: 20260626_120000_abcdef\r\n");
  assert.equal(parsed.content, "hello from hermes");
  assert.equal(parsed.sessionId, "20260626_120000_abcdef");
});

test("Hermes sessions table parser returns recent sessions", async () => {
  const { parseHermesSessionsList } = await import(chatManagerModulePath);
  const sessions = parseHermesSessionsList([
    "Preview                                            Last Active   Src    ID",
    "───────────────────────────────────────────────────────────────────────────────",
    "Reply with exactly: studio chat ok                 just now      studio 20260626_201807_b90299",
    "Acknowledge this local inference probe with a sh   2m ago        cli    20260626_201606_63a81c"
  ].join("\n"));

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].id, "20260626_201807_b90299");
  assert.equal(sessions[0].source, "studio");
  assert.equal(sessions[1].lastActive, "2m ago");
});

test("Hermes chat manager discovers Studio profiles", async () => {
  const { HermesChatManager } = await import(chatManagerModulePath);
  const manager = new HermesChatManager(path.resolve("."), { hermesCommand: "hermes" });
  const profiles = await manager.listProfiles();
  assert.equal(profiles.some((profile) => profile.id === "default"), true);
  assert.equal(profiles.some((profile) => profile.id === "test-profile"), true);
});

test("Hermes chat manager completes a local Studio chat run", { timeout: 120000 }, async () => {
  const { HermesChatManager } = await import(chatManagerModulePath);
  const manager = new HermesChatManager(path.resolve("."), {
    hermesCommand: process.execPath,
    hermesArgsPrefix: [path.resolve("tests/fixtures/hermes-chat-shim.mjs")],
    maxTurns: 1,
    timeoutMs: 120000
  });

  const completed = new Promise((resolve, reject) => {
    const unsubscribe = manager.onChatEvent((event) => {
      if (event.type === "runCompleted") {
        unsubscribe();
        resolve(event);
      }
      if (event.type === "runFailed") {
        unsubscribe();
        reject(new Error(event.error));
      }
      if (event.type === "runCancelled") {
        unsubscribe();
        reject(new Error("Run was cancelled."));
      }
    });
  });

  await manager.startRun({
    prompt: "Reply with exactly: milestone2 chat ok",
    profileId: "default",
    sessionId: null,
    attachmentIds: []
  });

  const event = await completed;
  assert.equal(event.type, "runCompleted");
  assert.match(event.message.content.toLowerCase(), /milestone2 chat ok/);
  assert.match(event.message.sessionId ?? "", /^[0-9]{8}_[0-9]{6}_[A-Za-z0-9]+$/);
});
