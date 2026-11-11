/** Error dari backend dengan format { error: { code, message } } (bagian 5.5). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Pemanggil API. Path relatif terhadap /api (di-proxy Next.js ke Express),
 * sehingga cookie httpOnly bersifat same-origin.
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server.");
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? `Terjadi kesalahan (HTTP ${res.status}).`,
    );
  }

  return data as T;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}
