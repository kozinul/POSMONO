import { v4 as uuidv4 } from 'uuid';

export interface DomainEventProps {
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  tenantId: string;
  correlationId?: string;
  causationId?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;

  constructor(props: DomainEventProps) {
    this.eventId = uuidv4();
    this.eventName = props.eventName;
    this.aggregateId = props.aggregateId;
    this.aggregateType = props.aggregateType;
    this.tenantId = props.tenantId;
    this.correlationId = props.correlationId || uuidv4();
    this.causationId = props.causationId || null;
    this.occurredAt = new Date();
    this.payload = props.payload;
    this.metadata = props.metadata || {};
  }
}
