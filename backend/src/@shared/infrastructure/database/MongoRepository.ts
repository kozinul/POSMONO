import { Model, Document, FilterQuery } from 'mongoose';
import { AggregateRoot } from '../../domain/AggregateRoot';
import { Identifier } from '../../domain/Identifier';
import { Repository } from '../../domain/Repository';

export abstract class MongoRepository<
  TAggregate extends AggregateRoot<TId>,
  TId extends Identifier,
  TDoc extends Document<any>,
> implements Repository<TAggregate, TId>
{
  protected abstract model: Model<any>;

  abstract toDomain(doc: TDoc): TAggregate;
  abstract toPersistence(aggregate: TAggregate): Partial<TDoc>;

  async save(aggregate: TAggregate): Promise<void> {
    const data = this.toPersistence(aggregate);
    await this.model.findOneAndUpdate(
      { _id: aggregate.id.toValue() } as FilterQuery<TDoc>,
      data,
      { upsert: true, new: true },
    );
    aggregate.clearEvents();
  }

  async findById(id: TId): Promise<TAggregate | null> {
    const doc = await this.model.findById(id.toValue()).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async exists(id: TId): Promise<boolean> {
    const doc = await this.model.findById(id.toValue()).exec();
    return !!doc;
  }

  async delete(id: TId): Promise<void> {
    await this.model.findByIdAndDelete(id.toValue()).exec();
  }
}
