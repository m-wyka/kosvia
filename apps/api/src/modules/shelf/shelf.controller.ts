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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RoutineAnalysisDto, ShelfItemDto } from '@kosvia/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ShelfService } from './shelf.service';
import { AddShelfItemDto, UpdateShelfItemDto } from './dto/shelf.dto';

@ApiTags('shelf')
@Controller('shelf')
export class ShelfController {
  constructor(private readonly shelf: ShelfService) {}

  @Get()
  @ApiOperation({ summary: 'Everything on the user’s shelf' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('favorites') favorites?: string,
  ): Promise<ShelfItemDto[]> {
    return this.shelf.list(user.id, favorites === 'true');
  }

  @Get('analysis')
  @ApiOperation({ summary: 'Descriptive routine analysis of the shelf' })
  analysis(@CurrentUser() user: AuthenticatedUser): Promise<RoutineAnalysisDto> {
    return this.shelf.analyse(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a product by id, slug or EAN' })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddShelfItemDto): Promise<ShelfItemDto> {
    return this.shelf.add(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notes, favourite flag or opened/finished dates' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShelfItemDto,
  ): Promise<ShelfItemDto> {
    return this.shelf.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product from the shelf' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.shelf.remove(user.id, id);
  }
}
