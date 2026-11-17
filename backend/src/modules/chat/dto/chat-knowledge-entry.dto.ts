import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export const KNOWLEDGE_TITLE_MAX_LENGTH = 150;
export const KNOWLEDGE_CONTENT_MAX_LENGTH = 1500;

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateChatKnowledgeEntryDto {
  @ApiProperty({
    minLength: 3,
    maxLength: KNOWLEDGE_TITLE_MAX_LENGTH,
    example: "Envíos a domicilio",
    description: "Short topic of the entry.",
  })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(KNOWLEDGE_TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({
    minLength: 10,
    maxLength: KNOWLEDGE_CONTENT_MAX_LENGTH,
    example:
      "Los domicilios se hacen desde las sedes que los tienen activos. El costo depende del barrio y se confirma por WhatsApp.",
    description: "Official information the chatbot can use as is.",
  })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(KNOWLEDGE_CONTENT_MAX_LENGTH)
  content!: string;

  @ApiPropertyOptional({
    default: true,
    description: "Only active entries reach the chatbot.",
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateChatKnowledgeEntryDto extends PartialType(
  CreateChatKnowledgeEntryDto,
) {}
