import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

export const CHAT_MODEL_CLIENT = Symbol("CHAT_MODEL_CLIENT");

export const DEFAULT_CHAT_MODEL = "claude-haiku-5-5";

export interface ChatModelClient {
  readonly available: boolean;
  readonly model: string;
  createMessage(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message>;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

@Injectable()
export class AnthropicChatModelClient implements ChatModelClient {
  private readonly client: Anthropic | null;
  readonly model = env("CHAT_MODEL") ?? DEFAULT_CHAT_MODEL;

  constructor() {
    const apiKey = env("ANTHROPIC_API_KEY");
    this.client =
      env("CHAT_ENABLED") === "false" || !apiKey
        ? null
        : new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  }

  get available(): boolean {
    return this.client !== null;
  }

  createMessage(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    if (!this.client) {
      return Promise.reject(new Error("The chatbot is not configured."));
    }
    return this.client.messages.create(params);
  }
}
