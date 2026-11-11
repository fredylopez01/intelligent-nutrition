import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 100,
    example: "Proteínas",
    description: "Category name. It must be unique.",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    maxLength: 255,
    example: "Suplementos de proteína",
    description: "Category description.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string;
}
