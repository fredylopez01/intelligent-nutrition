import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateSupplyStatusDto {
  @ApiProperty({ example: false, description: "New state of the supply." })
  @IsBoolean()
  active!: boolean;
}
