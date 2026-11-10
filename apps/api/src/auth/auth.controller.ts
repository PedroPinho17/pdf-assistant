import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { type AuthUser, CurrentUser, Public } from './auth.decorators';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './auth.constants';

type Credentials = { email?: unknown; password?: unknown };

// Brute-force protection: few attempts per minute per IP.
const AUTH_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  private readonly cookie: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookie = {
      httpOnly: true, // not readable from JavaScript (XSS can't steal it)
      sameSite: 'lax', // not sent on cross-site POSTs (CSRF)
      secure: config.get('NODE_ENV') === 'production', // HTTPS only in prod
      path: '/',
    };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  async register(
    @Body() body: Credentials,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.register(body?.email, body?.password);
    this.setSession(res, token);
    return user;
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: Credentials,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.login(body?.email, body?.password);
    this.setSession(res, token);
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookie);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  private setSession(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookie,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }
}
