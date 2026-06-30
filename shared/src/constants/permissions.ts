export const PERMISSIONS = {
  // Platform
  PLATFORM_TENANTS_READ: 'platform.tenants.read',
  PLATFORM_TENANTS_MANAGE: 'platform.tenants.manage',
  PLATFORM_PLANS_READ: 'platform.plans.read',
  PLATFORM_PLANS_MANAGE: 'platform.plans.manage',
  PLATFORM_REPORTS_READ: 'platform.reports.read',
  PLATFORM_SUPPORT_ACCESS: 'platform.support.access',

  // Identity
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE_ROLES: 'users.manage_roles',

  // Catalog
  CATALOG_PRODUCTS_READ: 'catalog.products.read',
  CATALOG_PRODUCTS_CREATE: 'catalog.products.create',
  CATALOG_PRODUCTS_UPDATE: 'catalog.products.update',
  CATALOG_PRODUCTS_DELETE: 'catalog.products.delete',
  CATALOG_CATEGORIES_READ: 'catalog.categories.read',
  CATALOG_CATEGORIES_MANAGE: 'catalog.categories.manage',

  // Orders
  ORDERS_READ: 'orders.read',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_REFUND: 'orders.refund',
  ORDERS_VOID: 'orders.void',
  ORDERS_OVERRIDE_PRICE: 'orders.override_price',

  // Inventory
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_TRANSFER: 'inventory.transfer',
  INVENTORY_COUNT: 'inventory.count',

  // POS
  POS_REGISTER_OPEN: 'pos.register.open',
  POS_REGISTER_CLOSE: 'pos.register.close',
  POS_SHIFT_OPEN: 'pos.shift.open',
  POS_SHIFT_CLOSE: 'pos.shift.close',
  POS_SALE_PROCESS: 'pos.sale.process',
  POS_RECEIPT_PRINT: 'pos.receipt.print',
  POS_DISCOUNT_APPLY: 'pos.discount.apply',
  POS_DISCOUNT_OVERRIDE_MAX: 'pos.discount.override_max',

  // Payments
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_PROCESS: 'payments.process',
  PAYMENTS_REFUND: 'payments.refund',
  PAYMENTS_VOID: 'payments.void',

  // Customers
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  // Reporting
  REPORTS_READ: 'reports.read',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_DASHBOARD_CUSTOMIZE: 'reports.dashboard.customize',

  // Settings
  SETTINGS_GENERAL_READ: 'settings.general.read',
  SETTINGS_GENERAL_UPDATE: 'settings.general.update',
  SETTINGS_PAYMENT_READ: 'settings.payment.read',
  SETTINGS_PAYMENT_UPDATE: 'settings.payment.update',
  SETTINGS_BILLING_READ: 'settings.billing.read',
  SETTINGS_BILLING_UPDATE: 'settings.billing.update',

  // Restaurant
  RESTAURANT_TABLES_READ: 'restaurant.tables.read',
  RESTAURANT_TABLES_MANAGE: 'restaurant.tables.manage',
  RESTAURANT_FLOOR_PLAN_MANAGE: 'restaurant.floor_plan.manage',
  RESTAURANT_KITCHEN_VIEW: 'restaurant.kitchen.view',
  RESTAURANT_KITCHEN_UPDATE_STATUS: 'restaurant.kitchen.update_status',
  RESTAURANT_RESERVATIONS_READ: 'restaurant.reservations.read',
  RESTAURANT_RESERVATIONS_MANAGE: 'restaurant.reservations.manage',
  RESTAURANT_SPLIT_BILL_PROCESS: 'restaurant.split_bill.process',
  RESTAURANT_PRINTER_MANAGE: 'restaurant.printer.manage',

  // Hospitality
  HOSPITALITY_PROPERTIES_READ: 'hospitality.properties.read',
  HOSPITALITY_PROPERTIES_MANAGE: 'hospitality.properties.manage',
  HOSPITALITY_ROOMS_READ: 'hospitality.rooms.read',
  HOSPITALITY_ROOMS_MANAGE: 'hospitality.rooms.manage',
  HOSPITALITY_BOOKINGS_READ: 'hospitality.bookings.read',
  HOSPITALITY_BOOKINGS_MANAGE: 'hospitality.bookings.manage',
  HOSPITALITY_CHECKIN_PROCESS: 'hospitality.checkin.process',
  HOSPITALITY_CHECKOUT_PROCESS: 'hospitality.checkout.process',
  HOSPITALITY_GUESTS_READ: 'hospitality.guests.read',
  HOSPITALITY_HOUSEKEEPING_VIEW: 'hospitality.housekeeping.view',
  HOSPITALITY_HOUSEKEEPING_MANAGE: 'hospitality.housekeeping.manage',
} as const;
