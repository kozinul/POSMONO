export interface Outlet {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string;
  warehouseId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
