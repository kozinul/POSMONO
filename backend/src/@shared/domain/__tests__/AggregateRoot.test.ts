import { describe, it, expect } from 'vitest';
import { AggregateRoot } from '../AggregateRoot';
import { Identifier } from '../Identifier';
import { DomainEvent } from '../DomainEvent';

class TestId extends Identifier {}
class TestAggregate extends AggregateRoot<TestId> {
  constructor() {
    super(new TestId('test-1'));
  }

  addTestEvent(): void {
    this.addDomainEvent(
      new DomainEvent({
        eventName: 'test.event',
        aggregateId: this.id.toValue(),
        aggregateType: 'Test',
        tenantId: 'tenant-1',
        payload: { key: 'value' },
      }),
    );
  }
}

describe('AggregateRoot', () => {
  it('initially has no domain events', () => {
    const agg = new TestAggregate();
    expect(agg.domainEvents).toHaveLength(0);
  });

  it('returns added domain events', () => {
    const agg = new TestAggregate();
    agg.addTestEvent();

    expect(agg.domainEvents).toHaveLength(1);
    expect(agg.domainEvents[0].eventName).toBe('test.event');
    expect(agg.domainEvents[0].aggregateId).toBe('test-1');
    expect(agg.domainEvents[0].tenantId).toBe('tenant-1');
    expect(agg.domainEvents[0].payload).toEqual({ key: 'value' });
  });

  it('returns a copy of domain events (immutable)', () => {
    const agg = new TestAggregate();
    agg.addTestEvent();

    const events = agg.domainEvents;
    events.push(new DomainEvent({
      eventName: 'fake',
      aggregateId: 'x',
      aggregateType: 'X',
      tenantId: 't',
      payload: {},
    }));

    expect(agg.domainEvents).toHaveLength(1);
  });

  it('clears events after clearEvents()', () => {
    const agg = new TestAggregate();
    agg.addTestEvent();
    agg.addTestEvent();

    expect(agg.domainEvents).toHaveLength(2);

    agg.clearEvents();
    expect(agg.domainEvents).toHaveLength(0);
  });

  it('can add events again after clearing', () => {
    const agg = new TestAggregate();
    agg.addTestEvent();
    agg.clearEvents();
    agg.addTestEvent();

    expect(agg.domainEvents).toHaveLength(1);
  });
});
