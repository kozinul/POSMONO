import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { DOMAIN_EVENTS } from '@posmono/shared';
import type { DomainEvent } from '../@shared/domain/DomainEvent';

async function onOrderCreated(event: DomainEvent): Promise<void> {
  console.log('[Event] Order created:', event.payload);
}

async function onOrderConfirmed(event: DomainEvent): Promise<void> {
  console.log('[Event] Order confirmed:', event.payload);
}

async function onPaymentCompleted(event: DomainEvent): Promise<void> {
  console.log('[Event] Payment completed:', event.payload);
}

async function onPaymentFailed(event: DomainEvent): Promise<void> {
  console.log('[Event] Payment failed:', event.payload);
}

async function onOrderCancelled(event: DomainEvent): Promise<void> {
  console.log('[Event] Order cancelled:', event.payload);
}

export function registerEventHandlers(eventBus: EventBus): void {
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CREATED, onOrderCreated);
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CONFIRMED, onOrderConfirmed);
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CANCELLED, onOrderCancelled);
  eventBus.subscribe(DOMAIN_EVENTS.PAYMENT_COMPLETED, onPaymentCompleted);
  eventBus.subscribe(DOMAIN_EVENTS.PAYMENT_FAILED, onPaymentFailed);
}
