import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateSupplyDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 150,
    example: "Leche entera",
    description: "Unique supply name, case insensitive.",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    format: "uuid",
    description: "Active unit of measure used for the stock.",
  })
  @IsUUID()
  @IsNotEmpty()
  unitOfMeasureId!: string;
}
