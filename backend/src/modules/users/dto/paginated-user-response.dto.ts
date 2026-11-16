import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserResponseDto } from "./user-response.dto.js";

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: "Current page (1-based)." })
  page!: number;

  @ApiProperty({ example: 10, description: "Items per page." })
  limit!: number;

  @ApiProperty({
    example: 42,
    description: "Total items matching the filters.",
  })
  total!: number;

  @ApiProperty({ example: 5, description: "Total number of pages." })
  totalPages!: number;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({
    type: [UserResponseDto],
    description: "Users of the current page.",
  })
  data!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto, description: "Pagination metadata." })
  meta!: PaginationMetaDto;

  @ApiPropertyOptional({ description: "Informational message." })
  message?: string;
}
