import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { DOMAIN_EVENTS } from '@posmono/shared';
import type { DomainEvent } from '../@shared/domain/DomainEvent';
import { getIO } from './socket';
import type { DIContainer } from './container';

async function onTenantCreatedProvision(event: DomainEvent, container: DIContainer): Promise<void> {
  try {
    const payload = event.payload as {
      tenantId: string;
      ownerId?: string;
      owner?: { email?: string; password?: string; displayName?: string } | null;
    };
    const onboardingService = container.resolve('onboardingService');
    const passwordService = container.resolve('passwordService');

    let owner;
    if (payload?.owner?.email && payload.owner.password) {
      owner = {
        email: payload.owner.email,
        displayName: payload.owner.displayName || payload.owner.email.split('@')[0],
        passwordHash: await passwordService.hash(payload.owner.password),
      };
    }

    await onboardingService.provision(payload.tenantId, owner);
  } catch {
    // provisioning must never break the tenant-creation request
  }
}

async function onOrderCreated(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderConfirmed(event: DomainEvent): Promise<void> {
  getIO()?.to(event.tenantId).emit('domain-event', event);
}

async function onOrderConfirmedAutoKot(event: DomainEvent, container: DIContainer): Promise<void> {
  try {
    const tenantRepository = container.resolve('tenantRepository');
    const tenant = await tenantRepository.findById(event.tenantId);
    if (!tenant) return;
    if (!tenant.serialize().config?.autoPrintKot) return;

    const orderId = event.aggregateId;
    const documentPrintService = container.resolve('documentPrintService');
    await documentPrintService.printKot({ tenantId: event.tenantId, orderId });
  } catch {
    // auto-print KOT must never break the ordering flow
  }
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

async function onOrderUpdated(event: DomainEvent): Promise<void> {
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

export function registerEventHandlers(eventBus: EventBus, container: DIContainer): void {
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CREATED, onOrderCreated);
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CONFIRMED, onOrderConfirmed);
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CONFIRMED, (event) => onOrderConfirmedAutoKot(event, container));
  eventBus.subscribe(DOMAIN_EVENTS.ORDER_CANCELLED, onOrderCancelled);
  eventBus.subscribe('ordering.order.paid', onOrderPaid);
  eventBus.subscribe('ordering.order.held', onOrderHeld);
  eventBus.subscribe('ordering.order.recalled', onOrderRecalled);
  eventBus.subscribe('ordering.order.updated', onOrderUpdated);
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
  eventBus.subscribe('platform.tenant.created', (event) => onTenantCreatedProvision(event, container));
}
