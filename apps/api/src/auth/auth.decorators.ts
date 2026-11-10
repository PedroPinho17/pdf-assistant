import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export type AuthUser = { id: string; email: string };

export const IS_PUBLIC = 'isPublic';

/** Marks a route as reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injects the user set by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    (ctx.switchToHttp().getRequest<Request & { user: AuthUser }>()).user,
);
