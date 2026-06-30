export const validTenantInput = {
  name: 'Cabang Kuta',
  slug: 'cabang-kuta',
  domain: null,
  ownerId: 'owner-1',
  plan: 'starter',
  status: 'active' as const,
  businessType: 'restaurant' as const,
  modules: ['pos', 'inventory'],
  databaseName: 'tenant-cabang-kuta',
  config: {
    timezone: 'Asia/Makassar',
    currency: 'IDR',
    locale: 'id-ID',
  },
  billingEmail: 'owner@cabangkuta.com',
};
