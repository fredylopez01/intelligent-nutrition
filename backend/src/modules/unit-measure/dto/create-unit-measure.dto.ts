import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateUnitMeasureDto {
  @ApiProperty({
    minLength: 5,
    maxLength: 50,
    example: "Kilogramo",
    description: "Unit of measure name. It must be unique.",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    maxLength: 10,
    example: "kg",
    description: "Abbreviation of the unit. It must be unique.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  abreviation!: string;
}
