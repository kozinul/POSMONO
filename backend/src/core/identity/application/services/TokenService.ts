import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../../../@shared/config/env';

export interface TokenPayload {
  sub: string;
  tenant: string;
  role: string;
  jti?: string;
  type?: 'access' | 'refresh';
}

export class TokenService {
  generateToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(
      { ...payload, jti: uuidv4(), type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions,
    );
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  }
}
