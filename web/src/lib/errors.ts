export class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
}
