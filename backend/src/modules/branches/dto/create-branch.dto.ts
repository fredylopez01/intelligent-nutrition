import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateBranchDto {
  @ApiProperty({
    maxLength: 100,
    example: "Sede Centro",
    description: "Branch name. It must be unique.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    maxLength: 255,
    example: "Carrera 10 # 20-30, Tunja",
    description: "Branch address.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @ApiProperty({
    maxLength: 30,
    example: "6017000000",
    description: "Branch phone number.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;
}
