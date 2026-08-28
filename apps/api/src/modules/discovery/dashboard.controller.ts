import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DashboardDto } from '@kosvia/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Everything the signed-in home screen needs' })
  load(@CurrentUser() user: AuthenticatedUser): Promise<DashboardDto> {
    return this.dashboard.load(user.id);
  }
}
