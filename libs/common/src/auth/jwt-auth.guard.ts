/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CanActivate, ExecutionContext, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, catchError, map, of, tap, timeout } from 'rxjs';
import { AUTH_SERVICE } from '../constants';
import { UserDto } from '../dto/user.dto';

export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(@Inject(AUTH_SERVICE) private readonly authClient: ClientProxy) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract JWT from cookies or headers (multiple possible header names)
    const jwt = this.extractToken(request);

    if (!jwt) {
      this.logger.debug('No authentication token found');
      return false;
    }

    this.logger.debug('Authenticating user with token');

    return this.authClient
      .send<UserDto>('authenticate', {
        Authentication: jwt,
      })
      .pipe(
        timeout(5000), // 5 second timeout for auth service
        tap((user: UserDto) => {
          this.logger.debug(
            `User authenticated: ${user.id || user.email || 'unknown'}`,
          );
          request.user = user;
        }),
        map(() => true),
        catchError((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`Authentication failed: ${errorMessage}`);
          return of(false);
        }),
      );
  }

  private extractToken(request: any): string | null {
    // Try multiple sources for the JWT token
    const sources = [
      // Cookies
      request.cookies?.Authentication,
      request.cookies?.authentication,
      request.cookies?.jwt,
      request.cookies?.access_token,

      // Headers
      request.headers?.authentication,
      request.headers?.authorization?.replace(/^Bearer\s+/i, ''), // Bearer token
      request.headers?.['x-auth-token'],
      request.headers?.['x-access-token'],
    ];

    for (const token of sources) {
      if (token && typeof token === 'string' && token.trim()) {
        return token.trim();
      }
    }

    return null;
  }
}
