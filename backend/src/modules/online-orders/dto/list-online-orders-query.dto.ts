import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { OnlineOrderFulfillmentDto } from "./create-online-order.dto.js";

export enum OnlineOrderStatusDto {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  READY = "READY",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export class ListOnlineOrdersQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    enum: OnlineOrderStatusDto,
    description:
      "PENDING only returns orders still on hold; EXPIRED includes pending orders past their hold.",
  })
  @IsOptional()
  @IsEnum(OnlineOrderStatusDto)
  status?: OnlineOrderStatusDto;

  @ApiPropertyOptional({ enum: OnlineOrderFulfillmentDto })
  @IsOptional()
  @IsEnum(OnlineOrderFulfillmentDto)
  fulfillment?: OnlineOrderFulfillmentDto;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4")
  branchId?: string;

  @ApiPropertyOptional({
    description: "Order code, customer name or phone (minimum 2 characters).",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  search?: string;
}
