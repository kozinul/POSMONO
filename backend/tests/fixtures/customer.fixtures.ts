export const validCustomerInput = {
  tenantId: 'tenant-test-1',
  name: 'Budi Santoso',
  phone: '081234567890',
  email: 'budi@example.com',
  address: 'Jl. Sudirman No. 1',
  isMember: true,
  tags: ['vip', 'regular'],
  preferences: { favoriteColor: 'blue' },
};

export const validCustomerInputNoMember = {
  tenantId: 'tenant-test-1',
  name: 'Ani Wijaya',
  phone: '089876543210',
  email: 'ani@example.com',
  address: '',
  isMember: false,
  tags: [],
  preferences: {},
};
