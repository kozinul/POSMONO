export declare const validOrderItem: {
    productId: string;
    variantId: null;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    modifiers: never[];
    tax: {
        rate: number;
        amount: number;
    };
};
export declare const validOrderInput: {
    tenantId: string;
    items: {
        productId: string;
        variantId: null;
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        modifiers: never[];
        tax: {
            rate: number;
            amount: number;
        };
    }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    customerId: null;
    cashierId: string;
    notes: string;
    source: "pos";
    metadata: {};
};
