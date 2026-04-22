import Constants from "expo-constants";

import type {
  AuthResponse,
  DashboardSummary,
  InventoryItem,
  TransactionLineInput,
  TransactionRecord,
  User,
  WorkshopProfile,
} from "./types";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  token?: string;
  body?: Record<string, unknown>;
};

type RegisterPayload = {
  username: string;
  full_name: string;
  password: string;
  email?: string;
};

type CreateUserPayload = RegisterPayload & {
  role: User["role"];
};

type ItemPayload = {
  name: string;
  category: string;
  price: number;
  stock: number;
  supplier: string;
  item_code: string;
  low_stock_threshold: number;
};

type TransactionPayload = {
  customer_name: string;
  mechanic_name: string;
  notes: string;
  payment_method: "tunai" | "transfer" | "kartu" | "qris";
  status: "paid" | "unpaid";
  discount: number;
  lines: TransactionLineInput[];
};

const getBaseUrl = () => {
  const extra = (Constants.expoConfig?.extra ?? {}) as { backendUrl?: string };
  const rawUrl = extra.backendUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
  return rawUrl.replace(/\/$/, "");
};

const API_BASE_URL = `${getBaseUrl()}/api`;

const buildHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.token),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({ detail: "Terjadi kesalahan" }))) as {
      detail?: string;
    };
    throw new Error(errorData.detail ?? "Terjadi kesalahan");
  }

  return (await response.json()) as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { username, password },
    }),

  register: (payload: RegisterPayload) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: payload,
    }),

  me: (token: string) => request<User>("/auth/me", { token }),

  getDashboardSummary: (token: string) => request<DashboardSummary>("/dashboard/summary", { token }),

  getWorkshop: (token: string) => request<WorkshopProfile>("/workshop", { token }),

  updateWorkshop: (token: string, payload: Omit<WorkshopProfile, "id" | "updated_at">) =>
    request<WorkshopProfile>("/workshop", {
      method: "PUT",
      token,
      body: payload,
    }),

  getItems: (token: string, search = "") =>
    request<InventoryItem[]>(`/items?q=${encodeURIComponent(search)}`, { token }),

  createItem: (token: string, payload: ItemPayload) =>
    request<InventoryItem>("/items", {
      method: "POST",
      token,
      body: payload,
    }),

  updateItem: (token: string, itemId: string, payload: ItemPayload) =>
    request<InventoryItem>(`/items/${itemId}`, {
      method: "PUT",
      token,
      body: payload,
    }),

  getTransactions: (token: string) => request<TransactionRecord[]>("/transactions", { token }),

  createTransaction: (token: string, payload: TransactionPayload) =>
    request<TransactionRecord>("/transactions", {
      method: "POST",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  getUsers: (token: string) => request<User[]>("/users", { token }),

  createUser: (token: string, payload: CreateUserPayload) =>
    request<User>("/users", {
      method: "POST",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  updateUserRole: (token: string, userId: string, role: User["role"]) =>
    request<User>(`/users/${userId}/role`, {
      method: "PATCH",
      token,
      body: { role },
    }),
};