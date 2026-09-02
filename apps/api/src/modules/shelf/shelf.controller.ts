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
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequiresPremium } from '../../common/decorators/requires-premium.decorator';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  RegulatoryAlertDto,
  RoutineAnalysisDto,
  RoutinePlanDto,
  ShelfItemDto,
} from '@kosvia/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ShelfService } from './shelf.service';
import { RegulatoryAlertsService } from './regulatory-alerts.service';
import { AddShelfItemDto, UpdateShelfItemDto } from './dto/shelf.dto';

@ApiTags('shelf')
@Controller('shelf')
export class ShelfController {
  constructor(
    private readonly shelf: ShelfService,
    private readonly regulatoryAlerts: RegulatoryAlertsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Everything on the user’s shelf' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('favorites') favorites?: string,
  ): Promise<ShelfItemDto[]> {
    return this.shelf.list(user, favorites === 'true');
  }

  @Get('analysis')
  @ApiOperation({ summary: 'Descriptive routine analysis of the shelf' })
  analysis(@CurrentUser() user: AuthenticatedUser): Promise<RoutineAnalysisDto> {
    return this.shelf.analyse(user);
  }

  @Get('routine-plan')
  @UseGuards(PremiumGuard)
  @RequiresPremium()
  @ApiOperation({ summary: 'Descriptive weekly AM/PM plan for the shelf' })
  plan(@CurrentUser() user: AuthenticatedUser): Promise<RoutinePlanDto> {
    return this.shelf.plan(user.id);
  }

  @Get('regulatory-alerts')
  @UseGuards(PremiumGuard)
  @RequiresPremium()
  @ApiOperation({ summary: 'Recent annex changes affecting products on the shelf' })
  regulatory(@CurrentUser() user: AuthenticatedUser): Promise<RegulatoryAlertDto[]> {
    return this.regulatoryAlerts.alertsFor(user.id);
  }

  @Post('regulatory-alerts/seen')
  @UseGuards(PremiumGuard)
  @RequiresPremium()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dismiss the current regulatory alerts' })
  dismissRegulatory(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.regulatoryAlerts.markSeen(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a product by id, slug or EAN' })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddShelfItemDto): Promise<ShelfItemDto> {
    return this.shelf.add(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notes, favourite flag or opened/finished dates' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShelfItemDto,
  ): Promise<ShelfItemDto> {
    return this.shelf.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product from the shelf' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.shelf.remove(user.id, id);
  }
}
