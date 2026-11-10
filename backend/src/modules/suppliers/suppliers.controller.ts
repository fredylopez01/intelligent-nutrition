import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateSupplierDto } from "./dto/create-supplier.dto.js";
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto.js";
import { UpdateSupplierDto } from "./dto/update-supplier.dto.js";
import { SuppliersService } from "./suppliers.service.js";

@ApiTags("Suppliers")
@ApiBearerAuth()
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "DEV")
  @ApiOperation({
    summary: "List suppliers",
    description:
      "Paginated list of suppliers. Roles: SUPERADMIN, BRANCH_LEADER, DEV.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of suppliers." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.findAll(query);
  }

  @Get(":supplierId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "DEV")
  @ApiOperation({
    summary: "Get a supplier",
    description: "Detail of a supplier. Roles: SUPERADMIN, BRANCH_LEADER, DEV.",
  })
  @ApiResponse({ status: 200, description: "Supplier detail." })
  @ApiResponse({ status: 400, description: "supplierId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  findOne(@Param("supplierId", new ParseUUIDPipe()) supplierId: string) {
    return this.suppliersService.findOne(supplierId);
  }

  @Patch(":supplierId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update a supplier",
    description:
      "Updates the commercial name and/or the person profile of a supplier. At least one field must be sent. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Supplier updated." })
  @ApiResponse({
    status: 400,
    description:
      "supplierId is not a valid UUID, invalid request body, or no field was provided.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  @ApiResponse({
    status: 409,
    description:
      "Document number or email already in use by another person (DOCUMENT_ALREADY_IN_USE, EMAIL_ALREADY_IN_USE).",
  })
  update(
    @Param("supplierId", new ParseUUIDPipe()) supplierId: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.suppliersService.update(
      supplierId,
      updateSupplierDto,
      currentUser,
      ipAddress,
    );
  }

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "DEV")
  @ApiOperation({
    summary: "Register a supplier",
    description:
      "Registers a supplier either from the data of a new person (person) or from an existing person (personId). Roles: SUPERADMIN, BRANCH_LEADER, DEV.",
  })
  @ApiResponse({ status: 201, description: "Supplier registered." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body: send either person or personId, not both.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Active person not found." })
  @ApiResponse({
    status: 409,
    description:
      "The person is already a supplier, or the email belongs to another person (ALREADY_SUPPLIER, EMAIL_ALREADY_IN_USE).",
  })
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.suppliersService.create(
      createSupplierDto,
      currentUser,
      ipAddress,
    );
  }
}
