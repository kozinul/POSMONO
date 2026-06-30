export class Result<T> {
  private constructor(
    public readonly success: boolean,
    public readonly value?: T,
    public readonly error?: string,
  ) {}

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, value);
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, undefined, error);
  }
}
