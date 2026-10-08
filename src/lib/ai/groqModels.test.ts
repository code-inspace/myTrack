import { describe, it, expect, vi, afterEach } from "vitest";
import { rankGroqModels, groqChatCompletion } from "./groqModels";

const MODELS = [
  { id: "whisper-large-v3", input_modalities: ["audio"], output_modalities: ["transcription"], context_window: 448 },
  { id: "meta-llama/llama-prompt-guard-2-86m", input_modalities: ["text"], output_modalities: ["text"], context_window: 512 },
  { id: "openai/gpt-oss-safeguard-20b", input_modalities: ["text"], output_modalities: ["text"], context_window: 131072 },
  { id: "canopylabs/orpheus-v1-english", input_modalities: ["text"], output_modalities: ["speech"], context_window: 4000 },
  { id: "openai/gpt-oss-20b", input_modalities: ["text"], output_modalities: ["text"], context_window: 131072 },
  { id: "qwen/qwen3.8-27b", input_modalities: ["text", "image"], output_modalities: ["text"], context_window: 131072 },
  { id: "openai/gpt-oss-120b", input_modalities: ["text"], output_modalities: ["text"], context_window: 131072 },
  { id: "old/retired-70b", active: false, input_modalities: ["text"], output_modalities: ["text"], context_window: 131072 },
];

describe("rankGroqModels", () => {
  it("keeps general chat models, biggest first", () => {
    expect(rankGroqModels(MODELS, "chat")).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]);
  });

  it("keeps only image-reading models for vision", () => {
    expect(rankGroqModels(MODELS, "vision")).toEqual(["qwen/qwen3.8-27b"]);
  });
});

describe("groqChatCompletion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves on to the next model when one is retired or rate-limited, then remembers the working one", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/models")) return new Response(JSON.stringify({ data: MODELS }));
        const model = JSON.parse(String(init?.body)).model;
        calls.push(model);
        if (model === "openai/gpt-oss-120b") {
          return new Response(JSON.stringify({ error: { message: "decommissioned", code: "model_decommissioned" } }), { status: 400 });
        }
        if (model === "qwen/qwen3.8-27b") {
          return new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 });
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      }),
    );

    const first = await groqChatCompletion("gsk_test", "chat", { messages: [] });
    expect(first.model).toBe("openai/gpt-oss-20b");
    expect(calls).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]);

    calls.length = 0;
    await groqChatCompletion("gsk_test", "chat", { messages: [] });
    expect(calls[0]).toBe("openai/gpt-oss-20b");
  });

  it("stops at once on an invalid key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/models")
          ? new Response(JSON.stringify({ data: MODELS }))
          : new Response(JSON.stringify({ error: { message: "Invalid API Key" } }), { status: 401 }),
      ),
    );
    await expect(groqChatCompletion("gsk_bad", "vision", { messages: [] })).rejects.toThrow("Invalid API Key");
  });
});
