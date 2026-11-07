import { IsIn, IsInt, Max, Min } from "class-validator";
import { SUPPORTED_MIME_TYPES } from "../../storage/magic-bytes.util.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export class ProfilePhotoUploadUrlDto {
  @IsIn(SUPPORTED_MIME_TYPES)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  sizeBytes!: number;
}
