export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  isMember: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: Date | null;
  tags: string[];
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  customerId: string;
  points: number;
  tier: string;
  pointsExpireAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyTransaction {
  id: string;
  tenantId: string;
  accountId: string;
  type: 'earn' | 'redeem' | 'expire';
  points: number;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}
