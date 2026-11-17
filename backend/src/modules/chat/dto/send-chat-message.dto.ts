import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export const CHAT_MESSAGE_MAX_LENGTH = 500;

export class SendChatMessageDto {
  @ApiProperty({
    minLength: 1,
    maxLength: CHAT_MESSAGE_MAX_LENGTH,
    example: "¿Tienen creatina en la sede de Tunja?",
    description: "Message written by the person.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(CHAT_MESSAGE_MAX_LENGTH)
  message!: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Conversation to continue. Omit it to start a new one; the response returns its id.",
  })
  @IsOptional()
  @IsUUID("all")
  conversationId?: string;
}
