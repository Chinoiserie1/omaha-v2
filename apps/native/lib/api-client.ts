import { BASE_URL } from "./api-url";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = "ApiError";
  }
}

type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export function resetTokenProvider() {
  tokenProvider = null;
}

async function buildHeaders(body?: unknown): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (tokenProvider) {
    const token = await tokenProvider();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = await buildHeaders(body);

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(response.status, errorBody);
  }

  const json = await response.json();

  // Unwrap ApiResponse<T> envelope if present
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) {
      throw new ApiError(response.status, json);
    }
    return json.data as T;
  }

  // Raw response (e.g. vaults endpoints that don't use envelope)
  return json as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
