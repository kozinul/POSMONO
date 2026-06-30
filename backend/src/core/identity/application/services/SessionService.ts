import { v4 as uuidv4 } from 'uuid';
import { UnauthorizedError } from '../../../../@shared/infrastructure/error/AppError';

interface SessionData {
  id: string;
  userId: string;
  tenantId: string;
  refreshToken: string;
  userAgent: string;
  ipAddress: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SessionService {
  constructor(private readonly model: any) {}

  async create(data: {
    userId: string;
    tenantId: string;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<SessionData> {
    const id = `sess_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const doc = await this.model.create({
      _id: id,
      userId: data.userId,
      tenantId: data.tenantId,
      refreshToken: data.refreshToken,
      userAgent: data.userAgent || '',
      ipAddress: data.ipAddress || '',
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return this.toData(doc);
  }

  async findByRefreshToken(token: string): Promise<SessionData | null> {
    const doc = await this.model.findOne({ refreshToken: token, isActive: true }).exec();
    if (!doc) return null;
    return this.toData(doc);
  }

  async invalidate(token: string): Promise<void> {
    await this.model.updateOne({ refreshToken: token }, { isActive: false }).exec();
  }

  async invalidateAllForUser(userId: string, tenantId: string): Promise<void> {
    await this.model
      .updateMany({ userId, tenantId, isActive: true }, { isActive: false })
      .exec();
  }

  private toData(doc: any): SessionData {
    return {
      id: doc._id,
      userId: doc.userId,
      tenantId: doc.tenantId,
      refreshToken: doc.refreshToken,
      userAgent: doc.userAgent,
      ipAddress: doc.ipAddress,
      isActive: doc.isActive,
      expiresAt: doc.expiresAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
