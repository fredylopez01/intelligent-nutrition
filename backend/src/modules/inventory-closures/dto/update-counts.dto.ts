import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CountItemDto {
  @IsUUID()
  productId!: string;

  @IsDateString(
    { strict: true },
    { message: "expirationDate must be a valid ISO 8601 date (YYYY-MM-DD)" },
  )
  expirationDate!: string;

  @IsInt()
  @Min(0)
  physicalQuantity!: number;

  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  observation?: string;
}

export class SupplyCountItemDto {
  @IsUUID()
  supplyId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  physicalQuantity!: number;

  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  observation?: string;
}

export class UpdateCountsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountItemDto)
  items?: CountItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyCountItemDto)
  supplyItems?: SupplyCountItemDto[];
}
