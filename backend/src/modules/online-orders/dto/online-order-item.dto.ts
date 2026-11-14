import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class OnlineOrderItemDto {
  @ApiProperty({ format: "uuid", description: "Product to order." })
  @IsUUID("4")
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 50, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class OrderAvailabilityDto {
  @ApiProperty({ type: [OnlineOrderItemDto], minItems: 1, maxItems: 30 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OnlineOrderItemDto)
  items!: OnlineOrderItemDto[];
}
