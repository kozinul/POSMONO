import { UseCase } from '../../../../@shared/application/UseCase';
import { User } from '../../domain/User';
import { PasswordService } from '../../domain/services/PasswordService';
import { UnauthorizedError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';

interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
  userAgent?: string;
  ipAddress?: string;
}

interface LoginOutput {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService implements UseCase<LoginInput, LoginOutput> {
  constructor(
    private readonly userRepository: any,
    private readonly tokenService: any,
    private readonly passwordService: PasswordService,
    private readonly sessionService: any,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepository.findByEmail(input.email, input.tenantId);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await this.passwordService.compare(input.password, user.passwordHashValue);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActiveUser()) {
      throw new UnauthorizedError('User account is inactive');
    }

    user.recordLogin();
    await this.userRepository.save(user);

    const refreshToken = this.tokenService.generateRefreshToken({
      sub: user.id.toValue(),
      tenant: input.tenantId,
      role: user.roleIdValue,
    });

    await this.sessionService.create({
      userId: user.id.toValue(),
      tenantId: input.tenantId,
      refreshToken,
      userAgent: input.userAgent || '',
      ipAddress: input.ipAddress || '',
    });

    const accessToken = this.tokenService.generateToken({
      sub: user.id.toValue(),
      tenant: input.tenantId,
      role: user.roleIdValue,
    });

    return { user, accessToken, refreshToken };
  }

  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: any;
    try {
      payload = this.tokenService.verifyToken(token);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }

    const session = await this.sessionService.findByRefreshToken(token);
    if (!session) {
      throw new UnauthorizedError('Session not found or expired');
    }

    await this.sessionService.invalidate(token);

    const newRefreshToken = this.tokenService.generateRefreshToken({
      sub: payload.sub,
      tenant: payload.tenant,
      role: payload.role,
    });

    await this.sessionService.create({
      userId: payload.sub,
      tenantId: payload.tenant,
      refreshToken: newRefreshToken,
    });

    const accessToken = this.tokenService.generateToken({
      sub: payload.sub,
      tenant: payload.tenant,
      role: payload.role,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessionService.invalidate(refreshToken);
  }

  async register(input: {
    tenantId: string;
    email: string;
    password: string;
    displayName: string;
    roleId: string;
  }): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email, input.tenantId);
    if (existing) {
      throw new ValidationError('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const user = User.create({
      tenantId: input.tenantId,
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      roleId: input.roleId,
      isActive: true,
      lastLoginAt: null,
      preferences: {},
    });

    await this.userRepository.save(user);
    return user;
  }

  async getCurrentUser(userId: string, tenantId: string): Promise<User | null> {
    const user = await this.userRepository.findByIdAndTenant(userId, tenantId);
    return user;
  }
}
