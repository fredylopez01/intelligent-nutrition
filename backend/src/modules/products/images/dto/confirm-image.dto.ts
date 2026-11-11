import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { SUPPORTED_MIME_TYPES } from "../../../storage/magic-bytes.util.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export class ConfirmImageDto {
  @ApiProperty({
    maxLength: 500,
    description: "Storage key returned by the upload-url endpoint.",
  })
  @IsString()
  @MaxLength(500)
  storageKey!: string;

  @ApiProperty({
    format: "uri",
    maxLength: 2000,
    description: "Public URL of the uploaded image.",
  })
  @IsUrl()
  @MaxLength(2000)
  url!: string;

  @ApiProperty({
    maxLength: 255,
    example: "vitamina-c.jpg",
    description: "Original file name.",
  })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    enum: SUPPORTED_MIME_TYPES,
    example: "image/jpeg",
    description:
      "MIME type of the image. It must match the content of the file.",
  })
  @IsIn(SUPPORTED_MIME_TYPES)
  mimeType!: string;

  @ApiProperty({
    minimum: 1,
    maximum: MAX_FILE_SIZE,
    example: 204800,
    description: "Size of the image in bytes (5 MB maximum).",
  })
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  sizeBytes!: number;

  @ApiPropertyOptional({
    description: "Whether this image becomes the primary image of the product.",
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 4,
    description: "Display position of the image (0 is the first).",
  })
  @IsInt()
  @Min(0)
  @Max(4)
  @IsOptional()
  sortOrder?: number;
}
