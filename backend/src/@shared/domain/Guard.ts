export class Guard {
  static againstEmpty(value: unknown, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${fieldName} must not be empty`);
    }
  }

  static againstNegative(value: number, fieldName: string): void {
    if (value < 0) {
      throw new Error(`${fieldName} must not be negative`);
    }
  }

  static againstZeroOrNegative(value: number, fieldName: string): void {
    if (value <= 0) {
      throw new Error(`${fieldName} must be positive`);
    }
  }

  static inRange(value: number, min: number, max: number, fieldName: string): void {
    if (value < min || value > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
  }

  static againstInvalidEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
  }
}
