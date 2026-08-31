import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AppReviewDto, AppReviewListResult } from '@kosvia/shared';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AppReviewsService } from './app-reviews.service';
import { AppReviewQueryDto, CreateAppReviewDto } from './dto/app-review.dto';

@ApiTags('app-reviews')
@Controller('app-reviews')
export class AppReviewsController {
  constructor(private readonly reviews: AppReviewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Visible portal reviews with the aggregate summary' })
  list(@Query() query: AppReviewQueryDto): Promise<AppReviewListResult> {
    return this.reviews.list(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'The user’s own review, if any' })
  findOwn(@CurrentUser() user: AuthenticatedUser): Promise<AppReviewDto | null> {
    return this.reviews.findOwn(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Review the portal — one review per account, no edits' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppReviewDto,
  ): Promise<AppReviewDto> {
    return this.reviews.create(user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the user’s own review' })
  removeOwn(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.reviews.removeOwn(user.id);
  }
}
