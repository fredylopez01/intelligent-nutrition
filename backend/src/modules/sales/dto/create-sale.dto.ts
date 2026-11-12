import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsMoneyString } from "./is-money-string.validator.js";

export class CreateSaleItemDto {
  @ApiProperty({ format: "uuid", description: "Product being sold." })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Recipe associated with this prepared item, when applicable.",
  })
  @IsOptional()
  @IsUUID()
  recipeId?: string;

  @ApiProperty({ minimum: 1, example: 2, description: "Units sold." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: "0.00",
    pattern: "^\\d+\\.\\d{2}$",
    description:
      "Discount applied to this line, as a decimal string with 2 decimals.",
  })
  @IsOptional()
  @IsMoneyString({
    message: 'discountAmount must be a decimal string (e.g. "0.00")',
  })
  @Matches(/^\d+\.\d{2}$/, {
    message: "discountAmount must have exactly 2 decimal places",
  })
  discountAmount?: string;

  @ApiPropertyOptional({
    example: "0.00",
    pattern: "^\\d+\\.\\d{2}$",
    description:
      "Tax applied to this line, as a decimal string with 2 decimals.",
  })
  @IsOptional()
  @IsMoneyString({
    message: 'taxAmount must be a decimal string (e.g. "0.00")',
  })
  @Matches(/^\d+\.\d{2}$/, {
    message: "taxAmount must have exactly 2 decimal places",
  })
  taxAmount?: string;
}

export class CreateSalePaymentDto {
  @ApiProperty({
    format: "uuid",
    description: "Payment method used for this payment.",
  })
  @IsUUID()
  @IsNotEmpty()
  paymentMethodId!: string;

  @ApiProperty({
    example: "290000.00",
    pattern: "^\\d+\\.\\d{2}$",
    description:
      "Amount paid with this method, as a decimal string with 2 decimals.",
  })
  @IsMoneyString({
    message: 'amount must be a decimal string (e.g. "290000.00")',
  })
  @Matches(/^\d+\.\d{2}$/, {
    message: "amount must have exactly 2 decimal places",
  })
  amount!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    description: "External reference of the payment (e.g. transaction number).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string | null;
}

export class CreateSaleDto {
  @ApiProperty({
    format: "uuid",
    description: "Branch where the sale takes place.",
  })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiPropertyOptional({
    type: String,
    format: "uuid",
    nullable: true,
    description:
      "Customer associated with the sale. Omit for an anonymous sale.",
  })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiProperty({
    type: [CreateSaleItemDto],
    minItems: 1,
    description: "Products sold. A product can appear only once.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @ApiPropertyOptional({
    example: "0.00",
    pattern: "^\\d+\\.\\d{2}$",
    description:
      "Discount applied to the whole sale, as a decimal string with 2 decimals.",
  })
  @IsOptional()
  @IsMoneyString({
    message: 'discountAmount must be a decimal string (e.g. "0.00")',
  })
  @Matches(/^\d+\.\d{2}$/, {
    message: "discountAmount must have exactly 2 decimal places",
  })
  discountAmount?: string;

  @ApiPropertyOptional({
    example: "0.00",
    pattern: "^\\d+\\.\\d{2}$",
    description:
      "Tax applied to the whole sale, as a decimal string with 2 decimals.",
  })
  @IsOptional()
  @IsMoneyString({
    message: 'taxAmount must be a decimal string (e.g. "0.00")',
  })
  @Matches(/^\d+\.\d{2}$/, {
    message: "taxAmount must have exactly 2 decimal places",
  })
  taxAmount?: string;

  @ApiPropertyOptional({
    type: String,
    format: "uuid",
    nullable: true,
    description:
      "Promotion to apply. Omit it to apply the active promotion, send null to sell without a promotion.",
  })
  @IsOptional()
  @IsUUID()
  promotionId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    description: "Reason of the custom discount sent in discountAmount.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountReason?: string | null;

  @ApiProperty({
    type: [CreateSalePaymentDto],
    minItems: 1,
    description:
      "Payments that settle the sale. Their sum must equal the sale total.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments!: CreateSalePaymentDto[];
}
