import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type Anthropic from "@anthropic-ai/sdk";
import { ChatService, plainText } from "./chat.service.js";
import type { ChatModelClient } from "./chat-model.client.js";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const NOW = new Date("2026-11-18T15:00:00.000Z");
const DAY_START = new Date("2026-11-18T05:00:00.000Z");
const user = {
  id: "user-1",
  active: true,
  role: { name: "BRANCH_ASSISTANT" },
} as never;

const prisma = {
  chatMessage: {
    count: jest.fn<AsyncMock>(),
    aggregate: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
    delete: jest.fn<AsyncMock>(),
  },
  chatConversation: {
    findFirst: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
  },
};
const knowledge = { activeItems: jest.fn<AsyncMock>() };
const tools = { run: jest.fn<AsyncMock>() };
const createMessage = jest.fn<ChatModelClient["createMessage"]>();
const model: ChatModelClient = {
  available: true,
  model: "claude-haiku-5-5",
  createMessage,
};

function reply(
  content: Anthropic.ContentBlock[],
  stop: Anthropic.StopReason = "end_turn",
): Anthropic.Message {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 50,
      cache_creation_input_tokens: 0,
    },
  } as unknown as Anthropic.Message;
}

const text = (value: string) =>
  ({ type: "text", text: value, citations: null }) as Anthropic.ContentBlock;
const toolUse = (id: string, name: string, input: object) =>
  ({ type: "tool_use", id, name, input }) as Anthropic.ContentBlock;

function service(client: ChatModelClient = model) {
  return new ChatService(
    prisma as never,
    knowledge as never,
    tools as never,
    client,
  );
}

describe("ChatService", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.resetAllMocks();
    delete process.env.CHAT_PUBLIC_DAILY_LIMIT;
    delete process.env.CHAT_INTERNAL_HOURLY_LIMIT;
    delete process.env.CHAT_MONTHLY_BUDGET_USD;
    prisma.chatMessage.count.mockResolvedValue(0);
    prisma.chatMessage.aggregate.mockResolvedValue({ _sum: { costUsd: null } });
    prisma.chatMessage.findMany.mockResolvedValue([]);
    prisma.chatMessage.create.mockResolvedValue({ id: "user-message" });
    prisma.chatConversation.create.mockResolvedValue({ id: "conv-new" });
    knowledge.activeItems.mockResolvedValue([
      { title: "Envíos", content: "Se coordinan por WhatsApp." },
    ]);
    createMessage.mockResolvedValue(reply([text("¡Hola! ¿En qué te ayudo?")]));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("answers an internal message and keeps the conversation", async () => {
    const result = await service().send(
      { message: "Hola" },
      { channel: "INTERNAL", user },
    );

    expect(result).toEqual({
      conversationId: "conv-new",
      response: "¡Hola! ¿En qué te ayudo?",
      escalate: false,
      whatsappUrl: null,
      limit: 10,
      remaining: 9,
    });
    expect(prisma.chatConversation.create).toHaveBeenCalledWith({
      data: { channel: "INTERNAL", clientKey: "user:user-1", userId: "user-1" },
      select: { id: true },
    });
    const [params] = createMessage.mock.calls[0];
    expect(params).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 600,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      cache_control: { type: "ephemeral" },
      messages: [{ role: "user", content: "Hola" }],
    });
    const system = params.system as Anthropic.TextBlockParam[];
    expect(system[1].text).toContain("BRANCH_ASSISTANT");
    expect(system[2]).toMatchObject({ cache_control: { type: "ephemeral" } });
    expect(system[2].text).toContain("[Envíos]");
    expect(prisma.chatMessage.create).toHaveBeenLastCalledWith({
      data: {
        conversationId: "conv-new",
        role: "ASSISTANT",
        content: "¡Hola! ¿En qué te ayudo?",
        inputTokens: 150,
        outputTokens: 20,
        costUsd: "0.000021",
      },
    });
  });

  it("sends the last messages of the conversation starting with the person", async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({ id: "conv-1" });
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { role: "USER", content: "¿Y en Tunja?" },
        { role: "ASSISTANT", content: "Hay 3 unidades." },
        { role: "USER", content: "¿Tienen creatina?" },
        { role: "ASSISTANT", content: "Respuesta antigua" },
      ]);

    await service().send(
      { message: "Gracias", conversationId: "conv-1" },
      { channel: "INTERNAL", user },
    );

    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: "conv-1", channel: "INTERNAL", userId: "user-1" },
      select: { id: true },
    });
    expect(createMessage.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "¿Tienen creatina?" },
      { role: "assistant", content: "Hay 3 unidades." },
      { role: "user", content: "¿Y en Tunja?" },
      { role: "user", content: "Gracias" },
    ]);
  });

  it("runs the tools the model asks for and returns its final answer", async () => {
    createMessage
      .mockResolvedValueOnce(
        reply(
          [toolUse("t1", "buscar_productos", { texto: "creatina" })],
          "tool_use",
        ),
      )
      .mockResolvedValueOnce(reply([text("La creatina cuesta $ 99.900.")]));
    tools.run.mockResolvedValue('{"productos":[]}');

    const result = await service().send(
      { message: "¿Cuánto vale la creatina?" },
      { channel: "PUBLIC", ip: "200.1.1.1" },
    );

    expect(tools.run).toHaveBeenCalledWith("buscar_productos", {
      texto: "creatina",
    });
    const secondCall = createMessage.mock.calls[1][0].messages;
    expect(secondCall.at(-1)).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "t1",
          content: '{"productos":[]}',
        },
      ],
    });
    expect(result.response).toBe("La creatina cuesta $ 99.900.");
    expect(result.whatsappUrl).toContain("https://wa.me/573102332100");
    expect(result.limit).toBe(5);
  });

  it("marks the conversation when the model escalates to a human", async () => {
    createMessage
      .mockResolvedValueOnce(
        reply(
          [toolUse("t1", "escalar_a_humano", { motivo: "Estado del pedido" })],
          "tool_use",
        ),
      )
      .mockResolvedValueOnce(
        reply([text("Escríbenos al WhatsApp 310 233 2100.")]),
      );
    tools.run.mockResolvedValue('{"escalado":true}');

    const result = await service().send(
      { message: "¿Dónde está mi pedido?" },
      { channel: "PUBLIC", ip: "200.1.1.1" },
    );

    expect(result.escalate).toBe(true);
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-new" },
      data: { escalated: true },
    });
  });

  it("escalates when the model declines the request", async () => {
    createMessage.mockResolvedValue(reply([], "refusal"));

    const result = await service().send(
      { message: "..." },
      { channel: "PUBLIC", ip: "200.1.1.1" },
    );

    expect(result.escalate).toBe(true);
    expect(result.response).toContain("WhatsApp 310 233 2100");
  });

  it("stops visitors at five messages per day and points them to WhatsApp", async () => {
    prisma.chatMessage.findMany.mockResolvedValue(
      Array.from({ length: 5 }, () => ({ createdAt: NOW })),
    );

    await expect(
      service().send(
        { message: "Hola" },
        { channel: "PUBLIC", ip: "200.1.1.1" },
      ),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: "CHAT_RATE_LIMIT",
        details: {
          limit: 5,
          window: "day",
          retryAt: new Date(DAY_START.getTime() + 24 * 60 * 60 * 1000),
          whatsappUrl: expect.stringContaining("wa.me/573102332100"),
        },
      },
    });
    const [query] = prisma.chatMessage.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(query.where).toMatchObject({
      role: "USER",
      createdAt: { gte: DAY_START },
      conversation: { channel: "PUBLIC", clientKey: expect.any(String) },
    });
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("stops internal users at ten messages per hour", async () => {
    const oldest = new Date(NOW.getTime() - 50 * 60 * 1000);
    prisma.chatMessage.findMany.mockResolvedValue([
      { createdAt: oldest },
      ...Array.from({ length: 9 }, () => ({ createdAt: NOW })),
    ]);

    await expect(
      service().send({ message: "Hola" }, { channel: "INTERNAL", user }),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: "CHAT_RATE_LIMIT",
        details: {
          limit: 10,
          window: "hour",
          retryAt: new Date(oldest.getTime() + 60 * 60 * 1000),
          whatsappUrl: null,
        },
      },
    });
  });

  it("stops the chatbot when today's share of the budget is spent", async () => {
    prisma.chatMessage.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: "0.9" } })
      .mockResolvedValueOnce({ _sum: { costUsd: "0.151" } });

    await expect(
      service().send(
        { message: "Hola" },
        { channel: "PUBLIC", ip: "200.1.1.1" },
      ),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: "CHAT_DAILY_LIMIT",
        details: {
          window: "day",
          retryAt: new Date("2026-11-19T05:00:00.000Z"),
          whatsappUrl: expect.stringContaining("wa.me/573102332100"),
        },
      },
    });
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("stops the chatbot until next month when the monthly budget is spent", async () => {
    process.env.CHAT_MONTHLY_BUDGET_USD = "2";
    prisma.chatMessage.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: "2.0001" } })
      .mockResolvedValueOnce({ _sum: { costUsd: "0" } });

    await expect(
      service().send({ message: "Hola" }, { channel: "INTERNAL", user }),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: "CHAT_DAILY_LIMIT",
        details: {
          window: "month",
          retryAt: new Date("2026-12-01T05:00:00.000Z"),
          whatsappUrl: null,
        },
      },
    });
  });

  it("adds up the cost of every round of a reply", async () => {
    createMessage
      .mockResolvedValueOnce(
        reply([toolUse("tool-1", "consultar_sedes", {})], "tool_use"),
      )
      .mockResolvedValueOnce(reply([text("Tenemos tres sedes.")]));
    tools.run.mockResolvedValue("[]");

    await service().send({ message: "¿Sedes?" }, { channel: "INTERNAL", user });

    expect(prisma.chatMessage.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ costUsd: "0.000041" }),
    });
  });

  it("shows the spend of the month only to the superadmin", async () => {
    prisma.chatMessage.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: "1.23456" } })
      .mockResolvedValueOnce({ _sum: { costUsd: "0.1" } });
    const superadmin = {
      ...(user as object),
      role: { name: "SUPERADMIN" },
    } as never;

    await expect(
      service().status({ channel: "INTERNAL", user: superadmin }),
    ).resolves.toMatchObject({
      available: true,
      budget: {
        monthlyUsd: 4.5,
        dailyUsd: 0.15,
        spentMonthUsd: 1.2346,
        spentTodayUsd: 0.1,
      },
    });
    await expect(
      service().status({ channel: "PUBLIC" }),
    ).resolves.not.toHaveProperty("budget");
  });

  it("keeps the same visitor key without storing the IP", async () => {
    await service().send(
      { message: "Hola" },
      { channel: "PUBLIC", ip: "200.1.1.1" },
    );
    await service().send(
      { message: "Hola" },
      { channel: "PUBLIC", ip: "200.1.1.1" },
    );

    const keys = prisma.chatConversation.create.mock.calls.map(
      ([args]) => (args as { data: { clientKey: string } }).data.clientKey,
    );
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(keys[0]).not.toContain("200.1.1.1");
  });

  it("answers 503 and forgets the message when the model fails", async () => {
    createMessage.mockRejectedValue(new Error("Claude API down"));

    await expect(
      service().send(
        { message: "Hola" },
        { channel: "PUBLIC", ip: "200.1.1.1" },
      ),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: "CHAT_UNAVAILABLE" },
    });
    expect(prisma.chatMessage.delete).toHaveBeenCalledWith({
      where: { id: "user-message" },
    });
  });

  it("answers 503 without saving anything when the API key is missing", async () => {
    await expect(
      service({ ...model, available: false }).send(
        { message: "Hola" },
        { channel: "INTERNAL", user },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });
});

describe("plainText", () => {
  it("removes the markdown marks the widget would show as symbols", () => {
    expect(
      plainText(
        "## Creatina\nSí tenemos **Creatina 300 g** a __$ 99.900__.\n* Bogotá: 33\n• Cali: 14\n- Tunja: 15",
      ),
    ).toBe(
      "Creatina\nSí tenemos Creatina 300 g a $ 99.900.\n- Bogotá: 33\n- Cali: 14\n- Tunja: 15",
    );
  });
});
