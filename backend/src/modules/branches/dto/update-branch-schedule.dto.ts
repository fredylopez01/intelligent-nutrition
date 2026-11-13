import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { TIME_PATTERN } from "../../../common/utils/branch-schedule.util.js";

export class ScheduleIntervalDto {
  @ApiProperty({ example: "08:00", description: "Opening time (HH:mm, 24 h)." })
  @Matches(TIME_PATTERN, { message: "opensAt must use the HH:mm format" })
  opensAt!: string;

  @ApiProperty({
    example: "13:00",
    description: "Closing time (HH:mm, 24 h). It must be after opensAt.",
  })
  @Matches(TIME_PATTERN, { message: "closesAt must use the HH:mm format" })
  closesAt!: string;
}

export class ScheduleDayDto {
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    example: 1,
    description: "Day of the week: 1 = Monday ... 7 = Sunday.",
  })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({
    type: [ScheduleIntervalDto],
    maxItems: 4,
    description:
      "Opening intervals of the day, for example 08:00-13:00 and 15:00-20:00. An empty list means the branch is closed that day.",
  })
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  intervals!: ScheduleIntervalDto[];
}

export class UpdateBranchScheduleDto {
  @ApiProperty({
    type: [ScheduleDayDto],
    maxItems: 7,
    description:
      "Weekly schedule. It replaces the whole schedule; days that are not sent stay closed.",
  })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];
}
