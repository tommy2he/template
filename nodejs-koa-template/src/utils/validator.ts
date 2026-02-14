export class ValidationError extends Error {
  status = 400;
  expose = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateString(
  value: any,
  fieldName: string,
  options?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  },
): string {
  if (value === undefined || value === null) {
    if (options?.required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const str = value.trim();

  if (options?.required && str.length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (options?.minLength && str.length < options.minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.minLength} characters`,
    );
  }

  if (options?.maxLength && str.length > options.maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.maxLength} characters`,
    );
  }

  if (options?.pattern && !options.pattern.test(str)) {
    throw new ValidationError(`${fieldName} has invalid format`);
  }

  return str;
}

export function validateNumber(
  value: any,
  fieldName: string,
  options?: {
    required?: boolean;
    min?: number;
    max?: number;
  },
): number {
  if (value === undefined || value === null) {
    if (options?.required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return 0;
  }

  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`);
  }

  if (options?.min !== undefined && num < options.min) {
    throw new ValidationError(`${fieldName} must be at least ${options.min}`);
  }

  if (options?.max !== undefined && num > options.max) {
    throw new ValidationError(`${fieldName} must be at most ${options.max}`);
  }

  return num;
}
