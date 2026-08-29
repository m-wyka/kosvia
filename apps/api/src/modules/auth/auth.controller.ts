import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthResponse, UserDto } from '@kosvia/shared';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AuthService, type IssuedSession } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { TokenService } from './token.service';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  type CookieSettings,
} from './auth.cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account and start a session' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.register(dto, req.headers['user-agent']);
    return this.respond(session, res);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.login(dto, req.headers['user-agent']);
    return this.respond(session, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!raw) throw new UnauthorizedException('No active session.');
    const session = await this.auth.refresh(raw, req.headers['user-agent']);
    return this.respond(session, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined);
    clearAuthCookies(res, this.cookieSettings);
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }

  private get cookieSettings(): CookieSettings {
    return {
      domain: this.config.get<string>('cookie.domain', ''),
      secure: this.config.get<boolean>('cookie.secure', false),
    };
  }

  private respond(session: IssuedSession, res: Response): AuthResponse {
    setAuthCookies(res, this.cookieSettings, {
      accessToken: session.accessToken,
      accessMaxAge: this.tokens.accessTtlMs(),
      refreshToken: session.refreshToken,
      refreshMaxAge: this.tokens.refreshTtlMs(),
    });
    return { user: session.user, accessToken: session.accessToken };
  }
}
