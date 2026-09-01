import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SkinDiaryEntryDto, SkinDiaryMonthDto } from '@kosvia/shared';
import { ConsentGuard } from '../../common/guards/consent.guard';
import { RequiresConsent } from '../../common/decorators/requires-consent.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { DiaryMonthQueryDto, UpsertSkinDiaryEntryDto } from './dto/diary.dto';

@ApiTags('diary')
@Controller('diary')
@UseGuards(ConsentGuard)
@RequiresConsent('BEAUTY_PROFILE_HEALTH')
export class DiaryController {
  constructor(private readonly diary: DiaryService) {}

  @Get()
  @ApiOperation({ summary: 'One month of skin diary entries with simple stats' })
  month(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DiaryMonthQueryDto,
  ): Promise<SkinDiaryMonthDto> {
    return this.diary.month(user.id, query.month);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Log or update one day — the user’s own words, never a diagnosis' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date') date: string,
    @Body() dto: UpsertSkinDiaryEntryDto,
  ): Promise<SkinDiaryEntryDto> {
    return this.diary.upsert(user.id, date, dto);
  }

  @Delete(':date')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one day from the diary' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('date') date: string): Promise<void> {
    return this.diary.remove(user.id, date);
  }
}
