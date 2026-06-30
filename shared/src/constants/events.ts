export const DOMAIN_EVENTS = {
  // Platform
  TENANT_CREATED: 'platform.tenant.created',
  TENANT_SUSPENDED: 'platform.tenant.suspended',
  TENANT_ACTIVATED: 'platform.tenant.activated',
  TENANT_CONFIG_UPDATED: 'platform.tenant.config.updated',
  USER_REGISTERED: 'platform.user.registered',
  USER_LOGGED_IN: 'platform.user.logged_in',
  USER_ROLE_ASSIGNED: 'platform.user.role.assigned',
  SUBSCRIPTION_CREATED: 'platform.subscription.created',
  INVOICE_PAID: 'platform.invoice.paid',
  INVOICE_OVERDUE: 'platform.invoice.overdue',

  // Catalog
  PRODUCT_CREATED: 'catalog.product.created',
  PRODUCT_UPDATED: 'catalog.product.updated',
  PRODUCT_DELETED: 'catalog.product.deleted',
  PRODUCT_PRICE_CHANGED: 'catalog.product.price.changed',

  // Ordering
  ORDER_CREATED: 'ordering.order.created',
  ORDER_CONFIRMED: 'ordering.order.confirmed',
  ORDER_CANCELLED: 'ordering.order.cancelled',
  ORDER_REFUNDED: 'ordering.order.refunded',

  // Payment
  PAYMENT_COMPLETED: 'payment.transaction.completed',
  PAYMENT_FAILED: 'payment.transaction.failed',
  PAYMENT_REFUNDED: 'payment.transaction.refunded',

  // Inventory
  STOCK_RESERVED: 'inventory.stock.reserved',
  STOCK_ADJUSTED: 'inventory.stock.adjusted',
  STOCK_RELEASED: 'inventory.stock.released',
  STOCK_LOW_ALERT: 'inventory.stock.low_alert',
  STOCK_OUT_OF_STOCK: 'inventory.stock.out_of_stock',

  // POS
  SHIFT_OPENED: 'pos.shift.opened',
  SHIFT_CLOSED: 'pos.shift.closed',
  SALE_COMPLETED: 'pos.sale.completed',
  RECEIPT_GENERATED: 'pos.receipt.generated',

  // Customer
  CUSTOMER_CREATED: 'customer.profile.created',
  LOYALTY_POINTS_EARNED: 'customer.loyalty.points_earned',
  LOYALTY_POINTS_REDEEMED: 'customer.loyalty.points_redeemed',

  // Restaurant
  TABLE_OCCUPIED: 'restaurant.table.occupied',
  TABLE_FREED: 'restaurant.table.freed',
  ORDER_SENT_TO_KITCHEN: 'restaurant.order.sent_to_kitchen',
  ORDER_READY: 'restaurant.order.ready',
  ORDER_SERVED: 'restaurant.order.served',
  SPLIT_BILL_CREATED: 'restaurant.split_bill.created',

  // Hospitality
  BOOKING_CREATED: 'hospitality.booking.created',
  BOOKING_CONFIRMED: 'hospitality.booking.confirmed',
  BOOKING_CANCELLED: 'hospitality.booking.cancelled',
  GUEST_CHECKED_IN: 'hospitality.booking.checked_in',
  GUEST_CHECKED_OUT: 'hospitality.booking.checked_out',
  HOUSEKEEPING_TASK_CREATED: 'hospitality.housekeeping.task_created',
  HOUSEKEEPING_TASK_COMPLETED: 'hospitality.housekeeping.task_completed',
} as const;
