import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { OrderAvailabilityDto } from "./online-order-item.dto.js";

export enum OnlineOrderFulfillmentDto {
  PICKUP = "PICKUP",
  DELIVERY = "DELIVERY",
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class OnlineOrderCustomerDto {
  @ApiProperty({ maxLength: 100, example: "Camilo" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ maxLength: 100, example: "Rojas Pineda" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    example: "3114827719",
    description: "Colombian mobile number, 10 digits starting with 3.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : value,
  )
  @Matches(/^3\d{9}$/, { message: "phone must be a Colombian mobile number" })
  phone!: string;

  @ApiPropertyOptional({
    maxLength: 150,
    description: "Required when register is true.",
  })
  @Transform(trim)
  @ValidateIf(
    (customer: OnlineOrderCustomerDto) =>
      customer.register === true || Boolean(customer.email),
  )
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiProperty({
    description:
      "Register (or link) the buyer as a customer with the document. Recommended.",
  })
  @IsBoolean()
  register!: boolean;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Required when register is true.",
  })
  @ValidateIf((customer: OnlineOrderCustomerDto) => customer.register === true)
  @IsUUID("4")
  documentTypeId?: string;

  @ApiPropertyOptional({
    example: "1049632145",
    maxLength: 50,
    description: "Required when register is true.",
  })
  @Transform(trim)
  @ValidateIf((customer: OnlineOrderCustomerDto) => customer.register === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      "Company name. When sent, the customer is registered as a company (the contact names stay on the order).",
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({
    maxLength: 255,
    description:
      "Customer address for the invoice. Required when register is true.",
  })
  @Transform(trim)
  @ValidateIf((customer: OnlineOrderCustomerDto) => customer.register === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;
}

export class OnlineOrderDeliveryDto {
  @ApiProperty({ maxLength: 255, example: "Calle 19 # 9-35, apto 402" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @ApiProperty({ maxLength: 100, example: "Centro" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  neighborhood!: string;
}

export class CreateOnlineOrderDto extends OrderAvailabilityDto {
  @ApiProperty({ enum: OnlineOrderFulfillmentDto })
  @IsEnum(OnlineOrderFulfillmentDto)
  fulfillment!: OnlineOrderFulfillmentDto;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Branch where the customer picks up. Required for PICKUP; ignored for DELIVERY.",
  })
  @ValidateIf(
    (order: CreateOnlineOrderDto) =>
      order.fulfillment === OnlineOrderFulfillmentDto.PICKUP,
  )
  @IsUUID("4")
  branchId?: string;

  @ApiProperty({ type: OnlineOrderCustomerDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnlineOrderCustomerDto)
  customer!: OnlineOrderCustomerDto;

  @ApiPropertyOptional({
    type: OnlineOrderDeliveryDto,
    description: "Required for DELIVERY (Tunja only).",
  })
  @ValidateIf(
    (order: CreateOnlineOrderDto) =>
      order.fulfillment === OnlineOrderFulfillmentDto.DELIVERY,
  )
  @IsDefined()
  @ValidateNested()
  @Type(() => OnlineOrderDeliveryDto)
  delivery?: OnlineOrderDeliveryDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
