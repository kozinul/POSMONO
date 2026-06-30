"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validOrderInput = exports.validOrderItem = void 0;
exports.validOrderItem = {
    productId: 'product-1',
    variantId: null,
    productName: 'Nasi Goreng',
    quantity: 2,
    unitPrice: 25000,
    totalPrice: 50000,
    modifiers: [],
    tax: { rate: 0, amount: 0 },
};
exports.validOrderInput = {
    tenantId: 'tenant-test-1',
    items: [exports.validOrderItem],
    subtotal: 50000,
    discount: 0,
    tax: 0,
    total: 50000,
    customerId: null,
    cashierId: 'cashier-1',
    notes: '',
    source: 'pos',
    metadata: {},
};
//# sourceMappingURL=ordering.fixtures.js.map