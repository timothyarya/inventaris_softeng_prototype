import type { AuthUser } from "../modules/auth/service";

declare global {
  namespace Express {
    interface Request {
      /** Diisi oleh middleware `authenticate` (dimuat ulang dari DB di setiap request). */
      user?: AuthUser;
    }
  }
}

export {};
