import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class ReportId extends Identifier {}

export interface IDailyMetric {
  id: string;
  tenantId: string;
  date: string;
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    avgOrderValue: number;
    topProducts: Array<{ productId: string; name: string; total: number }>;
    paymentMethodBreakdown: Record<string, number>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class DailyMetric extends AggregateRoot<ReportId> {
  private tenantId: string;
  private date: string;
  private metrics: IDailyMetric['metrics'];
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IDailyMetric) {
    super(new ReportId(props.id));
    this.tenantId = props.tenantId;
    this.date = props.date;
    this.metrics = props.metrics;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IDailyMetric, 'id' | 'createdAt' | 'updatedAt'>): DailyMetric {
    return new DailyMetric({
      ...props,
      id: new ReportId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IDailyMetric): DailyMetric {
    return new DailyMetric(props);
  }

  serialize(): IDailyMetric {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      date: this.date,
      metrics: this.metrics,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
