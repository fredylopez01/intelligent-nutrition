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
import { CreateUserDto } from "./dto/create-user.dto.js";
import { UsersService } from "./users.service.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { ListUsersQueryDto } from "./dto/list-users-query.dto.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { UpdateUserDto } from "./dto/update-user.dto.js";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";
import { AssignUserBranchDto } from "./dto/assign-user-branch.dto.js";
import { UpdateUserBranchDto } from "./dto/update-user-branch.dto.js";
import { ChangeUserRoleDto } from "./dto/change-user-role.dto.js";
import { UpdateOwnProfileDto } from "./dto/update-own-profile.dto.js";
import { ProfilePhotoUploadUrlDto } from "./dto/profile-photo-upload-url.dto.js";
import { PaginatedUsersResponseDto } from "./dto/paginated-user-response.dto.js";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "Create a user",
    description:
      "Creates a user account for a new person (person) or an existing one (personId) and sends the activation email. The account stays pending until the user sets a password. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({
    status: 201,
    description: "User created with status PENDING_ACTIVATION.",
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body: send either person or personId, the role must be active, branchIds cannot repeat and the person must have an email.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Role, active branches or person not found.",
  })
  @ApiResponse({
    status: 409,
    description: "The email or the person already has a user account.",
  })
  @ApiResponse({
    status: 500,
    description:
      "The user was created, but the activation email could not be sent.",
  })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.create(createUserDto, currentUser, ipAddress);
  }

  @Get()
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "List users",
    description: "Paginated list of users. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of users.",
    type: PaginatedUsersResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get("me")
  @ApiOperation({
    summary: "Get the own profile",
    description: "Profile of the authenticated user. Any authenticated user.",
  })
  @ApiResponse({ status: 200, description: "Own profile." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 404, description: "User not found." })
  getOwnProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.getOwnProfile(currentUser.id);
  }

  @Patch("me")
  @ApiOperation({
    summary: "Update the own profile",
    description:
      "Updates the personal data and the photo of the authenticated user. Any authenticated user.",
  })
  @ApiResponse({ status: 200, description: "Profile updated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body, no field provided, or profilePhotoUrl is not an uploaded storage URL.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 404, description: "User not found." })
  updateOwnProfile(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.updateOwnProfile(currentUser, dto, ipAddress);
  }

  @Post("me/photo-upload-url")
  @ApiOperation({
    summary: "Get a URL to upload the profile photo",
    description:
      "Returns a short-lived pre-signed URL to upload the photo directly to the storage, plus the storage key and the public URL to save afterwards with PATCH /users/me. Any authenticated user.",
  })
  @ApiResponse({ status: 201, description: "Pre-signed upload URL generated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body: unsupported MIME type or size above 5 MB.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  createProfilePhotoUploadUrl(
    @Body() dto: ProfilePhotoUploadUrlDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.createProfilePhotoUploadUrl(currentUser.id, dto);
  }

  @Get(":id")
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "Get a user",
    description: "Detail of a user. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "User detail." })
  @ApiResponse({ status: 400, description: "id is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "User not found." })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.usersService.findUserById(id);
  }

  @Get(":id/branches")
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "List the branch assignments of a user",
    description:
      "Every branch assignment of the user, active or not, newest first. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "Branch assignments of the user." })
  @ApiResponse({ status: 400, description: "id is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "User not found." })
  getBranches(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.usersService.getBranches(id);
  }

  @Post(":id/branches")
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "Assign a branch to a user",
    description: "Assigns an active branch to a user. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 201, description: "Branch assigned." })
  @ApiResponse({
    status: 400,
    description:
      "id is not a valid UUID, invalid body, or the branch is inactive.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "User or branch not found." })
  @ApiResponse({
    status: 409,
    description: "The user is already assigned to the branch.",
  })
  assignBranch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() assignUserBranchDto: AssignUserBranchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.assignBranch(
      id,
      assignUserBranchDto.branchId,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":id/branches/:branchId")
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "Deactivate a branch assignment",
    description:
      "Ends the active assignment of a user to a branch. Only deactivation is supported (active must be false). Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "Assignment deactivated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid ids or body, active is true, or the assignment is already inactive.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Branch assignment not found." })
  deactivateBranch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("branchId", new ParseUUIDPipe()) branchId: string,
    @Body() updateUserBranchDto: UpdateUserBranchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.deactivateBranch(
      id,
      branchId,
      updateUserBranchDto.active,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":id/role")
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "Change the role of a user",
    description:
      "Assigns another active role to a user. A user cannot change their own role. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "Role changed." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid id or body, own role, same role as the current one, or inactive role.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "User or role not found." })
  changeRole(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() changeUserRoleDto: ChangeUserRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.changeRole(
      id,
      changeUserRoleDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":id/status")
  @Roles("SUPERADMIN", "DEV")
  @ApiOperation({
    summary: "Activate or deactivate a user",
    description:
      "Changes the active status of an account. A user cannot deactivate their own account. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "User status updated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid id or body, or attempt to deactivate the own account.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "User not found." })
  updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.updateStatus(
      id,
      updateUserStatusDto.active,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a user",
    description:
      "Updates the person profile of a user. Any authenticated user can update their own account; SUPERADMIN and DEV can update any account.",
  })
  @ApiResponse({ status: 200, description: "User updated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid id or body, no field provided, or a user without privileges tried to update another account.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 404, description: "User not found." })
  @ApiResponse({
    status: 409,
    description:
      "Document number or email already in use by another person (DOCUMENT_ALREADY_IN_USE, EMAIL_ALREADY_IN_USE).",
  })
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser, ipAddress);
  }
}
