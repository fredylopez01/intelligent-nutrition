import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ChatKnowledgeService } from "./chat-knowledge.service.js";
import { ChatService } from "./chat.service.js";
import {
  CreateChatKnowledgeEntryDto,
  UpdateChatKnowledgeEntryDto,
} from "./dto/chat-knowledge-entry.dto.js";
import { SendChatMessageDto } from "./dto/send-chat-message.dto.js";

export function clientIp(request: Request): string {
  const forwarded = request.headers["x-forwarded-for"];
  const chain = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded)
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return chain?.at(-1) ?? request.ip ?? request.socket.remoteAddress ?? "";
}

const REPLY_DESCRIPTION =
  "Returns conversationId, response, escalate (true when the person should talk to a human), whatsappUrl (public channel only), limit and remaining messages.";

@ApiTags("Chat")
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly knowledgeService: ChatKnowledgeService,
  ) {}

  @Get("status")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Chatbot status for the signed-in user",
    description:
      "Whether the chatbot is configured and the message limit per hour. The superadmin also gets the spend of the month and of today against the budget (budget). Every authenticated role.",
  })
  @ApiResponse({ status: 200, description: "Status and limit." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.status({ channel: "INTERNAL", user });
  }

  @Post()
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Send a message to the chatbot",
    description: `Answers with the AI assistant (Claude Haiku 5.5 through the Claude API), which can look up products, prices, availability and branches. Keeps the conversation history. Limit: CHAT_INTERNAL_HOURLY_LIMIT messages per user per hour (10 by default). ${REPLY_DESCRIPTION} Every authenticated role.`,
  })
  @ApiResponse({ status: 200, description: "Chatbot answer." })
  @ApiResponse({ status: 400, description: "Invalid message." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 429,
    description:
      "Hourly limit reached (CHAT_RATE_LIMIT) or the spend budget of the chatbot is used up for today or this month (CHAT_DAILY_LIMIT, details.window day or month).",
  })
  @ApiResponse({
    status: 503,
    description: "The chatbot is not configured or failed (CHAT_UNAVAILABLE).",
  })
  send(
    @Body() dto: SendChatMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.send(dto, { channel: "INTERNAL", user });
  }

  @Get("public/status")
  @Public()
  @ApiOperation({
    summary: "Chatbot status for visitors",
    description:
      "Whether the chatbot is configured, the daily message limit per visitor and the WhatsApp link. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Status and limit." })
  publicStatus() {
    return this.chatService.status({ channel: "PUBLIC" });
  }

  @Post("public")
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: "Send a message to the chatbot as a visitor",
    description: `Same assistant for the public site. Limit: CHAT_PUBLIC_DAILY_LIMIT messages per visitor IP per day (5 by default); once reached, the visitor is sent to WhatsApp. ${REPLY_DESCRIPTION} Public endpoint.`,
  })
  @ApiResponse({ status: 200, description: "Chatbot answer." })
  @ApiResponse({ status: 400, description: "Invalid message." })
  @ApiResponse({
    status: 429,
    description:
      "Daily limit reached (CHAT_RATE_LIMIT) or the spend budget of the chatbot is used up for today or this month (CHAT_DAILY_LIMIT, details.window day or month); details.whatsappUrl points to the human channel.",
  })
  @ApiResponse({
    status: 503,
    description: "The chatbot is not configured or failed (CHAT_UNAVAILABLE).",
  })
  sendPublic(@Body() dto: SendChatMessageDto, @Req() request: Request) {
    return this.chatService.send(dto, {
      channel: "PUBLIC",
      ip: clientIp(request),
    });
  }

  @Get("knowledge")
  @Roles("SUPERADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List the chatbot knowledge base",
    description:
      "Every entry, active first. Active entries are added to the chatbot instructions. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Knowledge entries." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  listKnowledge() {
    return this.knowledgeService.list();
  }

  @Post("knowledge")
  @Roles("SUPERADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Add a knowledge entry",
    description:
      "Official information the chatbot can use as is (policies, shipping, payments). Up to 30 active entries. Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 201, description: "Entry created." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 422,
    description: "Too many active entries (CHAT_KNOWLEDGE_LIMIT).",
  })
  createKnowledge(
    @Body() dto: CreateChatKnowledgeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.knowledgeService.create(dto, user, ip);
  }

  @Patch("knowledge/:entryId")
  @Roles("SUPERADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update a knowledge entry",
    description:
      "Changes the title, the content or whether the entry is active. At least one field. Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Entry updated." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Entry not found (CHAT_KNOWLEDGE_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description: "Too many active entries (CHAT_KNOWLEDGE_LIMIT).",
  })
  updateKnowledge(
    @Param("entryId", new ParseUUIDPipe()) entryId: string,
    @Body() dto: UpdateChatKnowledgeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.knowledgeService.update(entryId, dto, user, ip);
  }

  @Delete("knowledge/:entryId")
  @Roles("SUPERADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Delete a knowledge entry",
    description: "Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Entry deleted." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Entry not found (CHAT_KNOWLEDGE_NOT_FOUND).",
  })
  removeKnowledge(
    @Param("entryId", new ParseUUIDPipe()) entryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.knowledgeService.remove(entryId, user, ip);
  }
}
