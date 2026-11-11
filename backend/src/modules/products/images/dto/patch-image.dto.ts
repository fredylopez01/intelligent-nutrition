import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class PatchImageDto {
  @ApiPropertyOptional({
    description:
      "Whether the image is the primary one. A product must keep at least one primary image.",
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 4,
    description: "New display position of the image (0 is the first).",
  })
  @IsInt()
  @Min(0)
  @Max(4)
  @IsOptional()
  sortOrder?: number;
}
