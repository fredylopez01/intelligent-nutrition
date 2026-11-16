import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateRecipeStatusDto {
  @ApiProperty({ example: false, description: "New state of the recipe." })
  @IsBoolean()
  active!: boolean;
}
