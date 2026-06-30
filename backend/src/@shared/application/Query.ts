export abstract class Query<TResult = unknown> {
  abstract readonly type: string;
}
