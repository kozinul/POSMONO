export const manifest = {
  name: 'restaurant',
  version: '1.0.0',
  displayName: 'Restaurant Module',
  description: 'Table management, kitchen display, waiter ordering, split bill, printer support',
  businessTypes: ['restaurant', 'mixed'],
  dependencies: ['ordering', 'inventory', 'pos'],
  permissions: [
    'restaurant.tables.manage',
    'restaurant.floor_plan.manage',
    'restaurant.kitchen.view',
    'restaurant.kitchen.update_status',
    'restaurant.reservations.manage',
    'restaurant.split_bill.process',
    'restaurant.printer.manage',
  ],
  eventHandlers: {
    'ordering.order.created': './application/eventHandlers/OnOrderCreated',
  },
};
