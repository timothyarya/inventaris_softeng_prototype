export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL_ERROR"
  | (string & {});

/**
 * Error bisnis dengan HTTP status. Format respons konsisten (bagian 5.5):
 * { "error": { "code": "STRING", "message": "..." } }
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code: ErrorCode = "VALIDATION_ERROR") =>
  new AppError(400, code, message);
export const unauthorized = (message = "Sesi tidak valid. Silakan login kembali.") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Anda tidak memiliki akses.") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Data tidak ditemukan.", code: ErrorCode = "NOT_FOUND") =>
  new AppError(404, code, message);
export const conflict = (message: string, code: ErrorCode = "CONFLICT") =>
  new AppError(409, code, message);
export const unprocessable = (message: string, code: ErrorCode = "UNPROCESSABLE") =>
  new AppError(422, code, message);
