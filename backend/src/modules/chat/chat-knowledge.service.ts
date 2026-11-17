import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { AuditService } from "../audit/audit.service.js";
import type { KnowledgeItem } from "./chat-prompt.js";
import {
  CreateChatKnowledgeEntryDto,
  UpdateChatKnowledgeEntryDto,
} from "./dto/chat-knowledge-entry.dto.js";

export const KNOWLEDGE_ACTIVE_LIMIT = 30;

const entrySelect = {
  id: true,
  title: true,
  content: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

function notFound() {
  return new NotFoundException({
    code: "CHAT_KNOWLEDGE_NOT_FOUND",
    message: "Knowledge entry not found.",
    details: {},
  });
}

@Injectable()
export class ChatKnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list() {
    return this.prisma.chatKnowledgeEntry.findMany({
      orderBy: [{ active: "desc" }, { title: "asc" }],
      select: entrySelect,
    });
  }

  async activeItems(): Promise<KnowledgeItem[]> {
    return this.prisma.chatKnowledgeEntry.findMany({
      where: { active: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: KNOWLEDGE_ACTIVE_LIMIT,
      select: { title: true, content: true },
    });
  }

  private async assertRoomForActive(excludeId?: string) {
    const active = await this.prisma.chatKnowledgeEntry.count({
      where: { active: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (active >= KNOWLEDGE_ACTIVE_LIMIT) {
      throw new UnprocessableEntityException({
        code: "CHAT_KNOWLEDGE_LIMIT",
        message: `Only ${KNOWLEDGE_ACTIVE_LIMIT} entries can be active at the same time.`,
        details: { limit: KNOWLEDGE_ACTIVE_LIMIT },
      });
    }
  }

  async create(
    dto: CreateChatKnowledgeEntryDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const active = dto.active ?? true;
    if (active) await this.assertRoomForActive();
    const entry = await this.prisma.chatKnowledgeEntry.create({
      data: { title: dto.title, content: dto.content, active },
      select: entrySelect,
    });
    await this.auditService.createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "CHAT_KNOWLEDGE",
      entityId: entry.id,
      newData: entry,
      reason: `Created chatbot knowledge entry ${entry.title}`,
      ipAddress,
    });
    return entry;
  }

  async update(
    id: string,
    dto: UpdateChatKnowledgeEntryDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "At least one field must be provided.",
        details: {},
      });
    }
    const existing = await this.prisma.chatKnowledgeEntry.findUnique({
      where: { id },
      select: entrySelect,
    });
    if (!existing) throw notFound();
    if (dto.active === true && !existing.active) {
      await this.assertRoomForActive(id);
    }
    const entry = await this.prisma.chatKnowledgeEntry.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.content === undefined ? {} : { content: dto.content }),
        ...(dto.active === undefined ? {} : { active: dto.active }),
      },
      select: entrySelect,
    });
    await this.auditService.createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "CHAT_KNOWLEDGE",
      entityId: id,
      oldData: existing,
      newData: entry,
      reason: `Updated chatbot knowledge entry ${entry.title}`,
      ipAddress,
    });
    return entry;
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.chatKnowledgeEntry.findUnique({
      where: { id },
      select: entrySelect,
    });
    if (!existing) throw notFound();
    await this.prisma.chatKnowledgeEntry.delete({ where: { id } });
    await this.auditService.createAuditLog({
      userId: user.id,
      action: "DELETE",
      entity: "CHAT_KNOWLEDGE",
      entityId: id,
      oldData: existing,
      reason: `Deleted chatbot knowledge entry ${existing.title}`,
      ipAddress,
    });
    return { message: "Knowledge entry deleted." };
  }
}
