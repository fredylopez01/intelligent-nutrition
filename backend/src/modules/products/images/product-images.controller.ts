import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ProductImagesService } from "./product-images.service.js";
import { GenerateUploadUrlDto } from "./dto/generate-upload-url.dto.js";
import { ConfirmImageDto } from "./dto/confirm-image.dto.js";
import { PatchImageDto } from "./dto/patch-image.dto.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../../common/interfaces/AuthenticatedUser.js";

@ApiTags("Product images")
@ApiBearerAuth()
@Controller("products/:productId/images")
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post("upload-url")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Get a URL to upload a product image",
    description:
      "Returns a short-lived pre-signed URL to upload the image directly to the storage, plus the storage key and the public URL to confirm it afterwards. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Pre-signed upload URL generated." })
  @ApiResponse({
    status: 400,
    description:
      "productId is not a valid UUID, or invalid body (unsupported MIME type or size above 5 MB).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Product not found." })
  @ApiResponse({
    status: 422,
    description:
      "The product already has the maximum number of images (IMAGE_LIMIT_REACHED).",
  })
  generateUploadUrl(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() dto: GenerateUploadUrlDto,
  ) {
    return this.productImagesService.generateUploadUrl(productId, dto);
  }

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Confirm an uploaded product image",
    description:
      "Registers an image that was already uploaded with the pre-signed URL, after checking that the object exists and that its content matches the declared MIME type. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Image registered." })
  @ApiResponse({
    status: 400,
    description: "productId is not a valid UUID, or invalid request body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the storage key does not belong to the product (STORAGE_KEY_MISMATCH).",
  })
  @ApiResponse({
    status: 404,
    description:
      "Product not found, or the object is not in the storage (STORAGE_OBJECT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The storage key is already registered (STORAGE_KEY_ALREADY_EXISTS).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Image limit reached, or the file content does not match the MIME type (IMAGE_LIMIT_REACHED, INVALID_FILE_CONTENT).",
  })
  confirm(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() dto: ConfirmImageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.productImagesService.confirmImage(
      productId,
      dto,
      currentUser.id,
      ipAddress,
    );
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List the images of a product",
    description:
      "Images of a product. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Images of the product." })
  @ApiResponse({ status: 400, description: "productId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Product not found." })
  list(@Param("productId", new ParseUUIDPipe()) productId: string) {
    return this.productImagesService.listImages(productId);
  }

  @Patch(":imageId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update an image of a product",
    description:
      "Marks the image as primary and/or changes its display position. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Image updated." })
  @ApiResponse({
    status: 400,
    description: "productId or imageId is not a valid UUID, or invalid body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Image not found." })
  @ApiResponse({
    status: 409,
    description:
      "The only image of the product cannot stop being primary (PRIMARY_IMAGE_REQUIRED).",
  })
  patch(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
    @Body() dto: PatchImageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.productImagesService.patchImage(
      productId,
      imageId,
      dto,
      currentUser.id,
      ipAddress,
    );
  }

  @Delete(":imageId")
  @HttpCode(204)
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Delete an image of a product",
    description:
      "Deletes the image from the storage and the database. If it was the primary one, another remaining image becomes primary. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 204, description: "Image deleted." })
  @ApiResponse({
    status: 400,
    description: "productId or imageId is not a valid UUID.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Image not found." })
  delete(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.productImagesService.deleteImage(
      productId,
      imageId,
      currentUser.id,
      ipAddress,
    );
  }
}
