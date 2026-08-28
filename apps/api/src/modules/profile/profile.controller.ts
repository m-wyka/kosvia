import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { BeautyProfileDto, TaxonomyItemDto } from '@kosvia/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ProfileService } from './profile.service';
import { UpdateBeautyProfileDto } from './dto/update-profile.dto';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Public()
  @Get('options')
  @ApiOperation({ summary: 'Concern and goal vocabulary for the onboarding form' })
  options(): Promise<{ concerns: TaxonomyItemDto[]; goals: TaxonomyItemDto[] }> {
    return this.profile.options();
  }

  /**
   * Returns the profile, or an explicit JSON `null` before onboarding.
   *
   * The response is written directly because Nest serialises a returned `null`
   * as an empty body: clients then receive `""`, which is not nullish, so
   * `profile?.concerns` silently yields `undefined` instead of short-circuiting.
   * "No profile yet" is a normal state here, so it has to be expressible.
   */
  @Get()
  @ApiOperation({ summary: 'The signed-in user’s beauty profile (null before onboarding)' })
  @ApiOkResponse({ description: 'The beauty profile, or null if onboarding has not run yet.' })
  async get(@CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    const profile = await this.profile.get(user.id);
    res.json(profile);
  }

  @Patch()
  @ApiOperation({ summary: 'Create or update the beauty profile' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBeautyProfileDto,
  ): Promise<BeautyProfileDto> {
    return this.profile.upsert(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset the beauty profile' })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.profile.remove(user.id);
  }
}
