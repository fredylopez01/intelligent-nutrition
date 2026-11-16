import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from "class-validator";
import { SUPPORTED_MIME_TYPES } from "../../../storage/magic-bytes.util.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export class GenerateUploadUrlDto {
  @ApiProperty({
    maxLength: 255,
    example: "vitamina-c.jpg",
    description: "File name of the image.",
  })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    enum: SUPPORTED_MIME_TYPES,
    example: "image/jpeg",
    description: "MIME type of the image to upload.",
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
}
