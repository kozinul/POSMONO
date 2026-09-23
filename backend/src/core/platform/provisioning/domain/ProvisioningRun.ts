import { AggregateRoot } from '../../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../../@shared/domain/Identifier';

class ProvisioningRunId extends Identifier {}

export type ProvisioningStepStatus = 'success' | 'failed' | 'skipped';

export interface IProvisioningStep {
  step: string;
  status: ProvisioningStepStatus;
  detail?: string | null;
  durationMs?: number | null;
}

export interface IProvisioningRun {
  id: string;
  requestId: string;
  idempotencyKey: string | null;
  tenantName: string;
  ownerEmail: string;
  hubId: string | null;
  mode: 'standalone' | 'hub';
  steps: IProvisioningStep[];
  overallStatus: 'success' | 'failed';
  durationMs: number;
  rolledBack: boolean;
  tenantId: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: Date;
}

export type ProvisioningRunProps = Omit<IProvisioningRun, 'id' | 'createdAt'> &
  Partial<Pick<IProvisioningRun, 'createdAt'>>;

export class ProvisioningRun extends AggregateRoot<ProvisioningRunId> {
  private requestId: string;
  private idempotencyKey: string | null;
  private tenantName: string;
  private ownerEmail: string;
  private hubId: string | null;
  private mode: 'standalone' | 'hub';
  private steps: IProvisioningStep[];
  private overallStatus: 'success' | 'failed';
  private durationMs: number;
  private rolledBack: boolean;
  private tenantId: string | null;
  private result: Record<string, unknown> | null;
  private error: string | null;
  private createdAt: Date;

  private constructor(props: IProvisioningRun) {
    super(new ProvisioningRunId(props.id));
    this.requestId = props.requestId;
    this.idempotencyKey = props.idempotencyKey;
    this.tenantName = props.tenantName;
    this.ownerEmail = props.ownerEmail;
    this.hubId = props.hubId;
    this.mode = props.mode;
    this.steps = props.steps;
    this.overallStatus = props.overallStatus;
    this.durationMs = props.durationMs;
    this.rolledBack = props.rolledBack;
    this.tenantId = props.tenantId;
    this.result = props.result;
    this.error = props.error;
    this.createdAt = props.createdAt;
  }

  static create(props: ProvisioningRunProps): ProvisioningRun {
    return new ProvisioningRun({
      ...props,
      id: new ProvisioningRunId().toValue(),
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static hydrate(props: IProvisioningRun): ProvisioningRun {
    return new ProvisioningRun(props);
  }

  addStep(step: string, status: ProvisioningStepStatus, detail?: string | null, durationMs?: number | null): void {
    this.steps.push({ step, status, detail: detail ?? null, durationMs: durationMs ?? null });
  }

  markStepDuration(index: number, durationMs: number): void {
    if (this.steps[index]) {
      this.steps[index].durationMs = durationMs;
    }
  }

  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  setDurationMs(durationMs: number): void {
    this.durationMs = durationMs;
  }

  setResult(result: Record<string, unknown>): void {
    this.result = result;
  }

  markCompleted(rolledBack: boolean): void {
    this.overallStatus = 'success';
    this.rolledBack = rolledBack;
    this.error = null;
  }

  markFailed(error: string, rolledBack: boolean): void {
    this.overallStatus = 'failed';
    this.rolledBack = rolledBack;
    this.error = error;
  }

  serialize(): IProvisioningRun {
    return {
      id: this._id.toValue(),
      requestId: this.requestId,
      idempotencyKey: this.idempotencyKey,
      tenantName: this.tenantName,
      ownerEmail: this.ownerEmail,
      hubId: this.hubId,
      mode: this.mode,
      steps: this.steps,
      overallStatus: this.overallStatus,
      durationMs: this.durationMs,
      rolledBack: this.rolledBack,
      tenantId: this.tenantId,
      result: this.result,
      error: this.error,
      createdAt: this.createdAt,
    };
  }
}