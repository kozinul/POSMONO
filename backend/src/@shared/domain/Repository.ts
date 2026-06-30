import { AggregateRoot } from './AggregateRoot';
import { Identifier } from './Identifier';

export interface Repository<
  TAggregate extends AggregateRoot<TId>,
  TId extends Identifier = Identifier,
> {
  save(aggregate: TAggregate): Promise<void>;
  findById(id: TId): Promise<TAggregate | null>;
  exists(id: TId): Promise<boolean>;
  delete(id: TId): Promise<void>;
}
