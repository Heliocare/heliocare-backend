export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string | undefined;

  // AppError class for handling operational errors
  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // Maintain proper stack trace for where the error was thrown (only available on V8)
    Error.captureStackTrace(this, this.constructor);
  }
}
