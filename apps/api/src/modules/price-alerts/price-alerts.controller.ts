import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PriceAlertDto } from '@kosvia/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { PriceAlertsService } from './price-alerts.service';
import { CreatePriceAlertDto, UpdatePriceAlertDto } from './dto/price-alert.dto';

@ApiTags('price-alerts')
@Controller('price-alerts')
export class PriceAlertsController {
  constructor(private readonly alerts: PriceAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'The user’s price alerts' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<PriceAlertDto[]> {
    return this.alerts.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Watch a product for a target price' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceAlertDto,
  ): Promise<PriceAlertDto> {
    return this.alerts.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change the target price or pause an alert' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePriceAlertDto,
  ): Promise<PriceAlertDto> {
    return this.alerts.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.alerts.remove(user.id, id);
  }
}
