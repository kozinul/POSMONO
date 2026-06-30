export const manifest = {
  name: 'hospitality',
  version: '1.0.0',
  displayName: 'Hospitality Module',
  description: 'Property/room management, booking engine, reservations, check-in/out, housekeeping',
  businessTypes: ['hospitality', 'mixed'],
  dependencies: ['ordering', 'payment', 'pos'],
  permissions: [
    'hospitality.properties.manage',
    'hospitality.rooms.manage',
    'hospitality.bookings.manage',
    'hospitality.checkin.process',
    'hospitality.checkout.process',
    'hospitality.guests.manage',
    'hospitality.housekeeping.manage',
  ],
  eventHandlers: {
    'payment.transaction.completed': './application/eventHandlers/OnPaymentCompleted',
  },
};
