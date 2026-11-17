import { createHash } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import type { ChatChannel } from "../../../generated/prisma/enums.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import {
  startOfBusinessDay,
  startOfBusinessMonth,
} from "../../common/utils/business-day.util.js";
import { ChatKnowledgeService } from "./chat-knowledge.service.js";
import {
  CHAT_MODEL_CLIENT,
  type ChatModelClient,
} from "./chat-model.client.js";
import { chatBudget, usageCostUsd } from "./chat-pricing.js";
import {
  PUBLIC_CHANNEL_PROMPT,
  PUBLIC_WHATSAPP_URL,
  WHATSAPP_DISPLAY,
  buildSystemPrompt,
  internalPrompt,
} from "./chat-prompt.js";
import {
  CHAT_TOOLS,
  ChatToolsService,
  ESCALATE_TOOL,
} from "./chat-tools.service.js";
import { SendChatMessageDto } from "./dto/send-chat-message.dto.js";

const HISTORY_MESSAGES = 10;
const MAX_TOOL_ROUNDS = 3;
const MAX_OUTPUT_TOKENS = 600;
const HOUR_MS = 60 * 60 * 1000;

export interface ChatRequester {
  channel: ChatChannel;
  user?: AuthenticatedUser;
  ip?: string;
}

export interface ChatReply {
  conversationId: string;
  response: string;
  escalate: boolean;
  whatsappUrl: string | null;
  limit: number;
  remaining: number;
}

interface Completion {
  text: string;
  escalate: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ChatSpend {
  monthlyUsd: number;
  dailyUsd: number;
  spentMonthUsd: number;
  spentTodayUsd: number;
}

function limitFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function chatLimits() {
  return {
    publicDaily: limitFromEnv("CHAT_PUBLIC_DAILY_LIMIT", 5),
    internalHourly: limitFromEnv("CHAT_INTERNAL_HOURLY_LIMIT", 10),
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[*•]\s+/gm, "$1- ")
    .trim();
}

function textOf(message: Anthropic.Message): string {
  return plainText(
    message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n"),
  );
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: ChatKnowledgeService,
    private readonly tools: ChatToolsService,
    @Inject(CHAT_MODEL_CLIENT) private readonly model: ChatModelClient,
  ) {}

  private isPublic(requester: ChatRequester) {
    return requester.channel === "PUBLIC";
  }

  private whatsapp(requester: ChatRequester) {
    return this.isPublic(requester) ? PUBLIC_WHATSAPP_URL : null;
  }

  private fallback(requester: ChatRequester) {
    return this.isPublic(requester)
      ? `Por ahora no puedo ayudarte con eso. Escríbenos al WhatsApp ${WHATSAPP_DISPLAY} y el equipo te atiende.`
      : "Por ahora no puedo ayudarte con eso. Consulta con el superadministrador del sistema.";
  }

  private clientKey(requester: ChatRequester): string {
    if (!this.isPublic(requester)) return `user:${requester.user?.id ?? ""}`;
    return createHash("sha256")
      .update(`chat:${requester.ip ?? "unknown"}`)
      .digest("hex");
  }

  private unavailable(requester: ChatRequester) {
    return new ServiceUnavailableException({
      code: "CHAT_UNAVAILABLE",
      message: "The chatbot is not available right now.",
      details: { whatsappUrl: this.whatsapp(requester) },
    });
  }

  private async checkLimits(
    requester: ChatRequester,
    clientKey: string,
    now: Date,
  ): Promise<{ limit: number; used: number }> {
    const limits = chatLimits();
    const dayStart = startOfBusinessDay(now);
    await this.checkBudget(requester, now);

    const isPublic = this.isPublic(requester);
    const since = isPublic ? dayStart : new Date(now.getTime() - HOUR_MS);
    const limit = isPublic ? limits.publicDaily : limits.internalHourly;
    const recent = await this.prisma.chatMessage.findMany({
      where: {
        role: "USER",
        createdAt: { gte: since },
        conversation: isPublic
          ? { channel: "PUBLIC", clientKey }
          : { channel: "INTERNAL", userId: requester.user?.id },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (recent.length >= limit) {
      const retryAt = isPublic
        ? new Date(dayStart.getTime() + 24 * HOUR_MS)
        : new Date(recent[recent.length - limit].createdAt.getTime() + HOUR_MS);
      throw new HttpException(
        {
          code: "CHAT_RATE_LIMIT",
          message: isPublic
            ? `You can send up to ${limit} messages per day.`
            : `You can send up to ${limit} messages per hour.`,
          details: {
            limit,
            window: isPublic ? "day" : "hour",
            retryAt,
            whatsappUrl: this.whatsapp(requester),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { limit, used: recent.length };
  }

  async spend(now = new Date()): Promise<ChatSpend> {
    const budget = chatBudget(now);
    const spentSince = async (since: Date) => {
      const total = await this.prisma.chatMessage.aggregate({
        where: { role: "ASSISTANT", createdAt: { gte: since } },
        _sum: { costUsd: true },
      });
      return Number(total._sum.costUsd ?? 0);
    };
    const [spentMonthUsd, spentTodayUsd] = await Promise.all([
      spentSince(startOfBusinessMonth(now)),
      spentSince(startOfBusinessDay(now)),
    ]);
    return {
      ...budget,
      spentMonthUsd: roundUsd(spentMonthUsd),
      spentTodayUsd: roundUsd(spentTodayUsd),
    };
  }

  private async checkBudget(requester: ChatRequester, now: Date) {
    const spend = await this.spend(now);
    const monthReached = spend.spentMonthUsd >= spend.monthlyUsd;
    if (!monthReached && spend.spentTodayUsd < spend.dailyUsd) return;
    const nextMonth = new Date(startOfBusinessMonth(now));
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    throw new HttpException(
      {
        code: "CHAT_DAILY_LIMIT",
        message: monthReached
          ? "The chatbot reached its budget for this month."
          : "The chatbot reached its budget for today.",
        details: {
          window: monthReached ? "month" : "day",
          retryAt: monthReached
            ? nextMonth
            : new Date(startOfBusinessDay(now).getTime() + 24 * HOUR_MS),
          whatsappUrl: this.whatsapp(requester),
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async conversation(
    requester: ChatRequester,
    clientKey: string,
    conversationId?: string,
  ) {
    if (conversationId) {
      const existing = await this.prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          channel: requester.channel,
          ...(this.isPublic(requester)
            ? { clientKey }
            : { userId: requester.user?.id }),
        },
        select: { id: true },
      });
      if (existing) return existing.id;
    }
    const created = await this.prisma.chatConversation.create({
      data: {
        channel: requester.channel,
        clientKey,
        userId: this.isPublic(requester) ? null : (requester.user?.id ?? null),
      },
      select: { id: true },
    });
    return created.id;
  }

  private async history(
    conversationId: string,
  ): Promise<Anthropic.MessageParam[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGES,
      select: { role: true, content: true },
    });
    const ordered = rows.reverse();
    while (ordered.length > 0 && ordered[0].role !== "USER") ordered.shift();
    return ordered.map((row) => ({
      role: row.role === "USER" ? "user" : "assistant",
      content: row.content,
    }));
  }

  private async complete(
    requester: ChatRequester,
    messages: Anthropic.MessageParam[],
  ): Promise<Completion> {
    const system = buildSystemPrompt(
      this.isPublic(requester)
        ? PUBLIC_CHANNEL_PROMPT
        : internalPrompt(requester.user?.role?.name ?? "interno"),
      await this.knowledge.activeItems(),
    );
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let escalate = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await this.model.createMessage({
        model: this.model.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        tools: CHAT_TOOLS,
        messages,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        cache_control: { type: "ephemeral" },
      });
      inputTokens +=
        response.usage.input_tokens +
        (response.usage.cache_read_input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0);
      outputTokens += response.usage.output_tokens;
      costUsd += usageCostUsd(response.usage);

      if (response.stop_reason === "refusal") {
        return {
          text: this.fallback(requester),
          escalate: true,
          inputTokens,
          outputTokens,
          costUsd,
        };
      }
      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = textOf(response);
        return {
          text: text || this.fallback(requester),
          escalate: escalate || !text,
          inputTokens,
          outputTokens,
          costUsd,
        };
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        if (toolUse.name === ESCALATE_TOOL) escalate = true;
        results.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: await this.tools.run(toolUse.name, toolUse.input),
        });
      }
      messages.push({ role: "user", content: results });
    }

    return {
      text: this.fallback(requester),
      escalate: true,
      inputTokens,
      outputTokens,
      costUsd,
    };
  }

  async send(
    dto: SendChatMessageDto,
    requester: ChatRequester,
  ): Promise<ChatReply> {
    if (!this.model.available) throw this.unavailable(requester);
    const now = new Date();
    const clientKey = this.clientKey(requester);
    const { limit, used } = await this.checkLimits(requester, clientKey, now);
    const conversationId = await this.conversation(
      requester,
      clientKey,
      dto.conversationId,
    );
    const history = await this.history(conversationId);
    const userMessage = await this.prisma.chatMessage.create({
      data: { conversationId, role: "USER", content: dto.message },
      select: { id: true },
    });

    let completion: Completion;
    try {
      completion = await this.complete(requester, [
        ...history,
        { role: "user", content: dto.message },
      ]);
    } catch (error) {
      this.logger.error(
        `Chat model call failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.prisma.chatMessage.delete({ where: { id: userMessage.id } });
      throw this.unavailable(requester);
    }

    await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: completion.text,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: completion.costUsd.toFixed(6),
      },
    });
    if (completion.escalate) {
      await this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: { escalated: true },
      });
    }

    return {
      conversationId,
      response: completion.text,
      escalate: completion.escalate,
      whatsappUrl: this.whatsapp(requester),
      limit,
      remaining: Math.max(0, limit - used - 1),
    };
  }

  async status(requester: ChatRequester) {
    const limits = chatLimits();
    const isSuperadmin =
      !this.isPublic(requester) && requester.user?.role?.name === "SUPERADMIN";
    return {
      available: this.model.available,
      limit: this.isPublic(requester)
        ? limits.publicDaily
        : limits.internalHourly,
      window: this.isPublic(requester) ? "day" : "hour",
      whatsappUrl: this.whatsapp(requester),
      ...(isSuperadmin ? { budget: await this.spend() } : {}),
    };
  }
}
