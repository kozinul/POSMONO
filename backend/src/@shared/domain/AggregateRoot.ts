import { Entity } from './Entity';
import { DomainEvent } from './DomainEvent';
import { Identifier } from './Identifier';

export abstract class AggregateRoot<TId extends Identifier = Identifier> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearEvents(): void {
    this._domainEvents = [];
  }
}
