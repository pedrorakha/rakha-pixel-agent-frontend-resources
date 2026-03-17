const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface ApiError {
  message: string;
  status: number;
}

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as ApiError;
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new ApiRequestError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(endpoint: string, body: unknown, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put<T>(endpoint: string, body: unknown, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  patch<T>(endpoint: string, body: unknown, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};
