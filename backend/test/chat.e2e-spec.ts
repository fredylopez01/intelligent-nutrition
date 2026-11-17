import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type Anthropic from "@anthropic-ai/sdk";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";
import {
  CHAT_MODEL_CLIENT,
  type ChatModelClient,
} from "../src/modules/chat/chat-model.client.js";

const runId = Date.now().toString(36);
const DOCUMENT_CODE = `CC-CHT-${runId}`.slice(0, 20);
const VISITOR_IP = `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.7`;
const OTHER_IP = `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.8`;
const errorBody = (response: request.Response) =>
  (
    response.body as {
      error: { code: string; details: Record<string, unknown> };
    }
  ).error;

interface ChatBody {
  data: {
    conversationId: string;
    response: string;
    escalate: boolean;
    whatsappUrl: string | null;
    limit: number;
    remaining: number;
  };
}

class FakeModel implements ChatModelClient {
  readonly available = true;
  readonly model = "anthropic.claude-haiku-5-5";
  readonly calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  private queue: Anthropic.ContentBlock[][] = [];

  answer(...turns: Anthropic.ContentBlock[][]) {
    this.queue.push(...turns);
  }

  createMessage(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    this.calls.push(structuredClone(params));
    const content = this.queue.shift() ?? [
      { type: "text", text: "Hola, soy el asistente.", citations: null },
    ];
    const usesTool = content.some((block) => block.type === "tool_use");
    return Promise.resolve({
      id: `msg_${this.calls.length}`,
      type: "message",
      role: "assistant",
      model: this.model,
      content,
      stop_reason: usesTool ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 120, output_tokens: 30 },
    } as unknown as Anthropic.Message);
  }
}

describe("Chatbot endpoint (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const fake = new FakeModel();
  const tokens: Record<string, string> = {};
  const personIds: string[] = [];
  const conversationIds = new Set<string>();
  const knowledgeIds: string[] = [];
  const ids = {
    documentType: "",
    branch: "",
    category: "",
    unit: "",
    product: "",
  };
  const server = () => request(app.getHttpServer());
  const remember = (response: request.Response) => {
    const id = (response.body as Partial<ChatBody>).data?.conversationId;
    if (id) conversationIds.add(id);
    return response;
  };
  const chat = async (message: string, token = tokens.BRANCH_ASSISTANT) =>
    remember(
      await server()
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${token}`)
        .send({ message }),
    );
  const chatPublic = async (message: string, ip = VISITOR_IP) =>
    remember(
      await server()
        .post("/api/v1/chat/public")
        .set("X-Forwarded-For", ip)
        .send({ message }),
    );

  beforeAll(async () => {
    process.env.CHAT_MONTHLY_BUDGET_USD = "100000";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CHAT_MODEL_CLIENT)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    ids.documentType = (
      await prisma.documentType.create({
        data: { code: DOCUMENT_CODE, name: "Documento (e2e chatbot)" },
      })
    ).id;
    ids.branch = (
      await prisma.branch.create({
        data: { name: `${runId} Sede chatbot`, address: "Calle 1", phone: "1" },
      })
    ).id;
    ids.category = (
      await prisma.category.create({ data: { name: `${runId} Cat chatbot` } })
    ).id;
    ids.unit = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Unidad chat`,
          abreviation: `C${runId.slice(-8)}`,
        },
      })
    ).id;
    ids.product = (
      await prisma.product.create({
        data: {
          name: `Creatina chat ${runId}`,
          referenceCode: `CHT-${runId}`,
          categoryId: ids.category,
          unitOfMeasureId: ids.unit,
          price: "99900.00",
        },
      })
    ).id;
    await prisma.branchInventory.create({
      data: {
        branchId: ids.branch,
        productId: ids.product,
        quantity: 4,
        expirationDate: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    const jwt = app.get(JwtService);
    for (const [index, roleName] of (
      ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const
    ).entries()) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId: ids.documentType,
          documentNumber: `${runId}${index}`,
          firstName: roleName,
          lastName: "Chatbot",
          email: `${roleName.toLowerCase()}.chat.${runId}@e2e.test`,
          phone: "3000000000",
          address: "Calle 1",
          userAccount: {
            create: {
              roleId: role.id,
              active: true,
              mustChangePassword: false,
            },
          },
        },
      });
      personIds.push(person.id);
      tokens[roleName] = await jwt.signAsync({ sub: person.id });
    }
  }, 60000);

  afterAll(async () => {
    if (!prisma) return;
    const userConversations = await prisma.chatConversation.findMany({
      where: { userId: { in: personIds } },
      select: { id: true },
    });
    const allIds = [
      ...conversationIds,
      ...userConversations.map(({ id }) => id),
    ];
    await prisma.chatMessage.deleteMany({
      where: { conversationId: { in: allIds } },
    });
    await prisma.chatConversation.deleteMany({ where: { id: { in: allIds } } });
    await prisma.chatKnowledgeEntry.deleteMany({
      where: { id: { in: knowledgeIds } },
    });
    await prisma.auditLog.deleteMany({ where: { userId: { in: personIds } } });
    await prisma.branchInventory.deleteMany({
      where: { productId: ids.product },
    });
    await prisma.product.deleteMany({ where: { id: ids.product } });
    await prisma.category.deleteMany({ where: { id: ids.category } });
    await prisma.unitMeasure.deleteMany({ where: { id: ids.unit } });
    await prisma.userAccount.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.branch.deleteMany({ where: { id: ids.branch } });
    await prisma.documentType.deleteMany({ where: { id: ids.documentType } });
    await app.close();
  }, 60000);

  it("asks for a session on the internal endpoint", async () => {
    const response = await server()
      .post("/api/v1/chat")
      .send({ message: "Hola" });

    expect(response.status).toBe(401);
  });

  it("answers an authenticated user and stores the conversation", async () => {
    const response = await chat("Hola");

    expect(response.status).toBe(200);
    const body = (response.body as ChatBody).data;
    expect(body).toMatchObject({
      response: "Hola, soy el asistente.",
      escalate: false,
      whatsappUrl: null,
      limit: 10,
      remaining: 9,
    });
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: body.conversationId },
      orderBy: { createdAt: "asc" },
    });
    expect(messages.map((message) => [message.role, message.content])).toEqual([
      ["USER", "Hola"],
      ["ASSISTANT", "Hola, soy el asistente."],
    ]);
    expect(messages[1].costUsd?.toString()).toBe("0.000027");
  });

  it("looks up real products with the catalog tool", async () => {
    fake.answer(
      [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "buscar_productos",
          input: { texto: `Creatina chat ${runId}` },
        } as Anthropic.ContentBlock,
      ],
      [
        {
          type: "text",
          text: "La creatina cuesta $ 99.900 y hay 4 unidades.",
          citations: null,
        },
      ],
    );
    const before = fake.calls.length;

    const response = await chat("¿Cuánto vale la creatina?");

    expect(response.status).toBe(200);
    expect((response.body as ChatBody).data.response).toBe(
      "La creatina cuesta $ 99.900 y hay 4 unidades.",
    );
    const followUp = fake.calls[before + 1].messages.at(-1) as {
      content: Array<{ type: string; content: string }>;
    };
    const toolResult = JSON.parse(followUp.content[0].content) as {
      productos: Array<Record<string, unknown>>;
    };
    expect(toolResult.productos[0]).toMatchObject({
      nombre: `Creatina chat ${runId}`,
      precio: 99900,
      sedes: [{ sede: `${runId} Sede chatbot`, unidades: 4 }],
    });
  });

  it("answers 429 after ten messages in an hour", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      statuses.push((await chat(`Mensaje ${index}`)).status);
    }
    const blocked = await chat("Uno más");

    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(blocked.status).toBe(429);
    expect(errorBody(blocked)).toMatchObject({
      code: "CHAT_RATE_LIMIT",
      details: { limit: 10, window: "hour" },
    });
    expect((await chat("Hola", tokens.BRANCH_LEADER)).status).toBe(200);
  });

  it("gives visitors five messages a day and then sends them to WhatsApp", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      statuses.push((await chatPublic(`Pregunta ${index}`)).status);
    }
    const blocked = await chatPublic("Otra pregunta");

    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect(blocked.status).toBe(429);
    expect(errorBody(blocked)).toMatchObject({
      code: "CHAT_RATE_LIMIT",
      details: {
        limit: 5,
        window: "day",
        whatsappUrl: expect.stringContaining("https://wa.me/573102332100"),
      },
    });
    expect((await chatPublic("Hola", OTHER_IP)).status).toBe(200);
  });

  it("lets only the superadmin manage the knowledge base the chatbot reads", async () => {
    const forbidden = await server()
      .post("/api/v1/chat/knowledge")
      .set("Authorization", `Bearer ${tokens.BRANCH_LEADER}`)
      .send({ title: "Envíos", content: "Se coordinan por WhatsApp." });
    const created = await server()
      .post("/api/v1/chat/knowledge")
      .set("Authorization", `Bearer ${tokens.SUPERADMIN}`)
      .send({
        title: `Envíos ${runId}`,
        content: "Los domicilios se coordinan por WhatsApp.",
      });

    expect(forbidden.status).toBe(403);
    expect(created.status).toBe(201);
    knowledgeIds.push((created.body as { data: { id: string } }).data.id);

    const before = fake.calls.length;
    await chat("¿Hacen envíos?", tokens.SUPERADMIN);
    const system = fake.calls[before].system as Anthropic.TextBlockParam[];
    expect(system.at(-1)?.text).toContain(`[Envíos ${runId}]`);

    const hidden = await server()
      .patch(`/api/v1/chat/knowledge/${knowledgeIds[0]}`)
      .set("Authorization", `Bearer ${tokens.SUPERADMIN}`)
      .send({ active: false });
    expect(hidden.status).toBe(200);
    await chat("¿Hacen envíos?", tokens.SUPERADMIN);
    const systemAfter = fake.calls.at(-1)?.system as Anthropic.TextBlockParam[];
    expect(systemAfter.at(-1)?.text).not.toContain(`[Envíos ${runId}]`);
  });

  it("reports the public status with the WhatsApp channel", async () => {
    const response = await server().get("/api/v1/chat/public/status");

    expect(response.status).toBe(200);
    expect((response.body as { data: unknown }).data).toEqual({
      available: true,
      limit: 5,
      window: "day",
      whatsappUrl: expect.stringContaining("wa.me/573102332100"),
    });
  });

  it("stops at the spend brake and shows the spend to the superadmin", async () => {
    const status = await server()
      .get("/api/v1/chat/status")
      .set("Authorization", `Bearer ${tokens.SUPERADMIN}`);
    expect(status.status).toBe(200);
    expect(
      (status.body as { data: { budget: { spentTodayUsd: number } } }).data
        .budget.spentTodayUsd,
    ).toBeGreaterThan(0);

    process.env.CHAT_MONTHLY_BUDGET_USD = "0.000001";
    try {
      const response = await chatPublic("Hola", "10.99.0.1");
      expect(response.status).toBe(429);
      expect(
        (response.body as { error: { code: string; details: unknown } }).error,
      ).toMatchObject({
        code: "CHAT_DAILY_LIMIT",
        details: { whatsappUrl: expect.stringContaining("wa.me/573102332100") },
      });
    } finally {
      process.env.CHAT_MONTHLY_BUDGET_USD = "100000";
    }
  });
});
