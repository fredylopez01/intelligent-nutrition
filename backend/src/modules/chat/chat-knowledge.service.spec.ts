import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ChatKnowledgeService } from "./chat-knowledge.service.js";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const prisma = {
  chatKnowledgeEntry: {
    count: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
    findUnique: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
    delete: jest.fn<AsyncMock>(),
  },
};
const audit = { createAuditLog: jest.fn<AsyncMock>() };
const admin = { id: "admin", active: true } as never;
const entry = {
  id: "e1",
  title: "Envíos",
  content: "Se coordinan por WhatsApp.",
  active: false,
};

function service() {
  return new ChatKnowledgeService(prisma as never, audit as never);
}

describe("ChatKnowledgeService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.chatKnowledgeEntry.count.mockResolvedValue(0);
    prisma.chatKnowledgeEntry.create.mockResolvedValue({
      ...entry,
      active: true,
    });
    prisma.chatKnowledgeEntry.findUnique.mockResolvedValue(entry);
    prisma.chatKnowledgeEntry.update.mockResolvedValue({
      ...entry,
      active: true,
    });
  });

  it("creates an active entry and audits it", async () => {
    await service().create(
      { title: "Envíos", content: "Se coordinan por WhatsApp." },
      admin,
      "1.1.1.1",
    );

    expect(prisma.chatKnowledgeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "Envíos",
          content: "Se coordinan por WhatsApp.",
          active: true,
        },
      }),
    );
    expect(audit.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "CHAT_KNOWLEDGE" }),
    );
  });

  it("keeps at most thirty active entries", async () => {
    prisma.chatKnowledgeEntry.count.mockResolvedValue(30);

    await expect(
      service().create(
        { title: "Pagos", content: "Aceptamos efectivo y tarjeta." },
        admin,
      ),
    ).rejects.toMatchObject({ response: { code: "CHAT_KNOWLEDGE_LIMIT" } });
    await expect(
      service().update("e1", { active: true }, admin),
    ).rejects.toMatchObject({ response: { code: "CHAT_KNOWLEDGE_LIMIT" } });
    expect(prisma.chatKnowledgeEntry.count).toHaveBeenLastCalledWith({
      where: { active: true, id: { not: "e1" } },
    });
  });

  it("asks for at least one field to update", async () => {
    await expect(service().update("e1", {}, admin)).rejects.toMatchObject({
      response: { code: "VALIDATION_ERROR" },
    });
  });

  it("answers 404 for an entry that does not exist", async () => {
    prisma.chatKnowledgeEntry.findUnique.mockResolvedValue(null);

    await expect(service().remove("e9", admin)).rejects.toMatchObject({
      response: { code: "CHAT_KNOWLEDGE_NOT_FOUND" },
    });
  });
});
