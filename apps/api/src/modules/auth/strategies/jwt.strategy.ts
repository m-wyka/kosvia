import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type JwtFromRequestFunction } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth.cookies';
import type { AccessTokenPayload } from '../token.service';

/** Reads the access token from the HttpOnly cookie first, then the header. */
const fromCookie: JwtFromRequestFunction = (req: Request) =>
  (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // Re-read the role from the database so a demotion takes effect immediately
    // rather than at the end of the token's lifetime.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Your session is no longer valid.');
    return user;
  }
}
