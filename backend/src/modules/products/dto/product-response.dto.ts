import { ApiProperty } from "@nestjs/swagger";

export class ProductResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "Vitamina C 1000 mg 30 cápsulas" })
  name!: string;

  @ApiProperty({ example: "VIT-C-1000-30C" })
  referenceCode!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ format: "uuid" })
  categoryId!: string;

  @ApiProperty({ format: "uuid" })
  unitOfMeasureId!: string;

  @ApiProperty({
    example: "98000.00",
    description: "Sale price as a decimal string.",
  })
  price!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "URL of the primary image, or null when the product has none.",
  })
  primaryImageUrl!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}
