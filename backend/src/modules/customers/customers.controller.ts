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
import { CreateCustomerDto } from "./dto/create-customer.dto.js";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto.js";
import { CustomersService } from "./customers.service.js";
import { UpdateCustomerStatusDto } from "./dto/update-customer-status.dto.js";
import { UpdateCustomerDto } from "./dto/update-customer.dto.js";

@ApiTags("Customers")
@ApiBearerAuth()
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List customers",
    description:
      "Paginated list of customers. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of customers." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListCustomersQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(":customerId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a customer",
    description:
      "Detail of a customer. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Customer detail." })
  @ApiResponse({ status: 400, description: "customerId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  findOne(@Param("customerId", new ParseUUIDPipe()) customerId: string) {
    return this.customersService.findOne(customerId);
  }

  @Patch(":customerId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Update a customer",
    description:
      "Updates the person profile of a customer. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Customer updated." })
  @ApiResponse({
    status: 400,
    description: "customerId is not a valid UUID, or invalid request body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  @ApiResponse({
    status: 409,
    description:
      "Document number or email already in use by another person (DOCUMENT_ALREADY_IN_USE, EMAIL_ALREADY_IN_USE).",
  })
  update(
    @Param("customerId", new ParseUUIDPipe()) customerId: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.customersService.update(
      customerId,
      updateCustomerDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":customerId/status")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Activate or deactivate a customer",
    description:
      "Changes the active status of a customer. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Customer status updated." })
  @ApiResponse({
    status: 400,
    description: "customerId is not a valid UUID, or invalid request body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  @ApiResponse({
    status: 409,
    description:
      "The customer is already in the requested state (ALREADY_IN_STATE).",
  })
  updateStatus(
    @Param("customerId", new ParseUUIDPipe()) customerId: string,
    @Body() updateCustomerStatusDto: UpdateCustomerStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.customersService.updateStatus(
      customerId,
      updateCustomerStatusDto.active,
      currentUser,
      ipAddress,
    );
  }

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Register a customer",
    description:
      "Registers a customer either from the data of a new person (person) or from an existing person (personId). Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 201, description: "Customer registered." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body: send either person or personId, and businessName or both firstName and lastName.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Active person not found." })
  @ApiResponse({
    status: 409,
    description:
      "The person is already a customer, or the email belongs to another person (ALREADY_CUSTOMER, EMAIL_ALREADY_IN_USE).",
  })
  create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.customersService.create(
      createCustomerDto,
      currentUser,
      ipAddress,
    );
  }
}
