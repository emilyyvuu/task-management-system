export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data?: unknown) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as Record<string, unknown>).error)
        : "Request failed";
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";

function buildUrl(path: string) {
  if (path.startsWith("http")) {
    return path;
  }
  if (!path.startsWith("/")) {
    return `${API_ORIGIN}/${path}`;
  }
  return `${API_ORIGIN}${path}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const url = buildUrl(path);
  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
  });

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.data === "object" && error.data && "error" in (error.data as Record<string, unknown>)) {
      return String((error.data as Record<string, unknown>).error);
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}
