import { IsBoolean } from "class-validator";

export class UpdateRecipeStatusDto {
  @IsBoolean()
  active!: boolean;
}
