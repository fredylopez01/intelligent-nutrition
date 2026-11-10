import { IsBoolean } from "class-validator";

export class UpdateSupplyStatusDto {
  @IsBoolean()
  active!: boolean;
}
