import { afterEach, describe, expect, it } from "@jest/globals";
import { AnthropicChatModelClient } from "./chat-model.client.js";

describe("AnthropicChatModelClient", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CHAT_ENABLED;
    delete process.env.CHAT_MODEL;
  });

  it("stays off without an API key", async () => {
    const client = new AnthropicChatModelClient();

    expect(client.available).toBe(false);
    await expect(
      client.createMessage({ model: "x", max_tokens: 1, messages: [] }),
    ).rejects.toThrow("The chatbot is not configured.");
  });

  it("turns on with an API key and uses Claude Haiku 5.5 by default", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    const client = new AnthropicChatModelClient();

    expect(client.available).toBe(true);
    expect(client.model).toBe("claude-haiku-5-5");
  });

  it("can be turned off without removing the key", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.CHAT_ENABLED = "false";

    expect(new AnthropicChatModelClient().available).toBe(false);
  });
});
