import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { DOMAIN_EVENTS } from '@posmono/shared';
import type { DomainEvent } from '../@shared/domain/DomainEvent';
import { getIO } from './socket';

async function onOrderCreated(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderConfirmed(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onPaymentCompleted(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onPaymentFailed(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderCancelled(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderPaid(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderHeld(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderRecalled(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onProductChanged(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onDiscountConfigUpdated(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onStockAdjusted(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onStockLowAlert(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onTaxConfigUpdated(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

export function registerEventHandlers(eventBus: EventBus): void {
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CREATED, onOrderCreated);
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CONFIRMED, onOrderConfirmed);
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CANCELLED, onOrderCancelled);
  eventBus.subscribe('ordering.order.paid', onOrderPaid);
  eventBus.subscribe('ordering.order.held', onOrderHeld);
  eventBus.subscribe('ordering.order.recalled', onOrderRecalled);
  eventBus.subscribe(DOMAIN_EVENTS.PAYMENT_COMPLETED, onPaymentCompleted);
  eventBus.subscribe(DOMAIN_EVENTS.PAYMENT_FAILED, onPaymentFailed);
  eventBus.subscribe(DOMAIN_EVENTS.PRODUCT_CREATED, onProductChanged);
  eventBus.subscribe(DOMAIN_EVENTS.PRODUCT_UPDATED, onProductChanged);
  eventBus.subscribe(DOMAIN_EVENTS.PRODUCT_DELETED, onProductChanged);
  eventBus.subscribe(DOMAIN_EVENTS.PRODUCT_PRICE_CHANGED, onProductChanged);
  eventBus.subscribe(DOMAIN_EVENTS.DISCOUNT_CONFIG_UPDATED, onDiscountConfigUpdated);
  eventBus.subscribe(DOMAIN_EVENTS.TAX_CONFIG_UPDATED, onTaxConfigUpdated);
  eventBus.subscribe('inventory.stock.adjusted', onStockAdjusted);
  eventBus.subscribe('inventory.stock.low_alert', onStockLowAlert);
}
