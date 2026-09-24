export function authProfileHttpError(status: number, message: string, details?: Record<string, unknown>) {
  const error: any = new Error(message);
  error.status = status;
  if (details) Object.assign(error, details);
  return error;
}
