export abstract class Command<TResult = void> {
  abstract readonly type: string;
}
