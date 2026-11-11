import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty({
    format: "uuid",
    description: "User id (same as the person id).",
  })
  id!: string;

  @ApiProperty({
    format: "uuid",
    description: "Id of the person that owns the account.",
  })
  personId!: string;

  @ApiProperty({ type: String, format: "email", nullable: true })
  email!: string | null;

  @ApiProperty({
    type: "object",
    description: "Personal data of the user.",
    properties: {
      id: { type: "string", format: "uuid" },
      firstName: { type: "string", nullable: true },
      lastName: { type: "string", nullable: true },
      email: { type: "string", format: "email", nullable: true },
      phone: { type: "string", nullable: true },
      address: { type: "string", nullable: true },
      profilePhotoUrl: { type: "string", nullable: true },
    },
  })
  person!: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    profilePhotoUrl: string | null;
  };

  @ApiProperty({
    type: "object",
    description: "Role assigned to the account.",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string", example: "BRANCH_LEADER" },
    },
  })
  role!: {
    id: string;
    name: string;
  };

  @ApiProperty({
    type: "array",
    description: "Branches the user is assigned to.",
    items: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
      },
    },
  })
  branches!: Array<{ id: string; name: string }>;

  @ApiProperty({ description: "Whether the account is active." })
  active!: boolean;

  @ApiProperty({
    description:
      "Whether the user must set a password before using the account.",
  })
  mustChangePassword!: boolean;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}
