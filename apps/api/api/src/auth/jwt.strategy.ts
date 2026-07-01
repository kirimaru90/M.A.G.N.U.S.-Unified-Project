import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  role: 'admin' | 'player';
}

export interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'player';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Mirror the sign side: the secret resolves from the single `jwtSecret`
      // config value, and the fallback here matches the config's own default
      // (configuration.ts) so a missing JWT_SECRET verifies with the exact
      // secret it was signed with. A divergent fallback would make every token
      // silently fail verification.
      secretOrKey:
        configService.get<string>('jwtSecret') ?? 'change-me-in-production',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.role) throw new UnauthorizedException();
    return { id: payload.sub, role: payload.role };
  }
}
