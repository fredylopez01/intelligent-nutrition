import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { BranchesModule } from "../branches/branches.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ChatKnowledgeService } from "./chat-knowledge.service.js";
import {
  AnthropicChatModelClient,
  CHAT_MODEL_CLIENT,
} from "./chat-model.client.js";
import { ChatToolsService } from "./chat-tools.service.js";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

@Module({
  imports: [PrismaModule, AuditModule, CatalogModule, BranchesModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatKnowledgeService,
    ChatToolsService,
    { provide: CHAT_MODEL_CLIENT, useClass: AnthropicChatModelClient },
  ],
})
export class ChatModule {}
