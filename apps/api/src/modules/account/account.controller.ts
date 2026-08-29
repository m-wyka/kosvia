import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AccountExportDto, ConsentsDto } from '@kosvia/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { clearAuthCookies, type CookieSettings } from '../auth/auth.cookies';
import { AccountService } from './account.service';
import { ConsentService } from './consent.service';
import { DeleteAccountDto, SetConsentDto } from './dto/account.dto';

@ApiTags('account')
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly consents: ConsentService,
    private readonly config: ConfigService,
  ) {}

  @Get('consents')
  @ApiOperation({ summary: 'Consents in force and their full history' })
  async listConsents(@CurrentUser() user: AuthenticatedUser): Promise<ConsentsDto> {
    const [current, history] = await Promise.all([
      this.consents.currentState(user.id),
      this.consents.history(user.id),
    ]);
    return { current, history };
  }

  @Put('consents')
  @ApiOperation({
    summary: 'Grant or withdraw one consent (withdrawing health consent erases the beauty profile)',
  })
  async setConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetConsentDto,
    @Req() req: Request,
  ): Promise<ConsentsDto> {
    await this.account.setConsent(user.id, dto.type, dto.granted, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.listConsents(user);
  }

  @Get('export')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Everything we hold about the signed-in user, as JSON (art. 15 / 20)' })
  exportData(@CurrentUser() user: AuthenticatedUser): Promise<AccountExportDto> {
    return this.account.exportData(user.id);
  }

  @Delete()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Schedule the account for deletion after a 7-day grace period' })
  async requestDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ executeAt: string }> {
    const executeAt = await this.account.requestDeletion(user.id, dto.password);
    clearAuthCookies(res, this.cookieSettings);
    return { executeAt: executeAt.toISOString() };
  }

  @Post('deletion/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw a pending deletion request' })
  cancelDeletion(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.account.cancelDeletion(user.id);
  }

  private get cookieSettings(): CookieSettings {
    return {
      domain: this.config.get<string>('cookie.domain', ''),
      secure: this.config.get<boolean>('cookie.secure', false),
    };
  }
}
