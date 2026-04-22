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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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

type UpdateUserPayload = {
  username: string;
  full_name: string;
  email?: string;
  role: User["role"];
  password?: string;
};

type ItemPayload = {
  name: string;
  stock: number;
  item_code: string;
  unit: string;
  cost_price: number;
  workshop_price: number;
  consumer_price: number;
  notes: string;
  category: string;
  supplier: string;
  low_stock_threshold: number;
};

type TransactionPayload = {
  customer_name: string;
  mechanic_name: string;
  notes: string;
  payment_method: "tunai" | "transfer" | "kartu" | "qris";
  status: "paid" | "unpaid";
  discount: number;
  amount_paid: number;
  lines: TransactionLineInput[];
};

type TransactionFilters = {
  startDate?: string;
  endDate?: string;
  status?: string;
  mechanicName?: string;
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

  deleteItem: (token: string, itemId: string) =>
    request<{ message: string }>(`/items/${itemId}`, {
      method: "DELETE",
      token,
    }),

  getTransactions: (token: string, filters: TransactionFilters = {}) => {
    const query = new URLSearchParams();
    if (filters.startDate) {
      query.set("start_date", filters.startDate);
    }
    if (filters.endDate) {
      query.set("end_date", filters.endDate);
    }
    if (filters.status && filters.status !== "all") {
      query.set("status", filters.status);
    }
    if (filters.mechanicName) {
      query.set("mechanic_name", filters.mechanicName);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<TransactionRecord[]>(`/transactions${suffix}`, { token });
  },

  getTransaction: (token: string, transactionId: string) =>
    request<TransactionRecord>(`/transactions/${transactionId}`, { token }),

  createTransaction: (token: string, payload: TransactionPayload) =>
    request<TransactionRecord>("/transactions", {
      method: "POST",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  updateTransaction: (token: string, transactionId: string, payload: TransactionPayload) =>
    request<TransactionRecord>(`/transactions/${transactionId}`, {
      method: "PUT",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  deleteTransaction: (token: string, transactionId: string) =>
    request<{ message: string }>(`/transactions/${transactionId}`, {
      method: "DELETE",
      token,
    }),

  getUsers: (token: string) => request<User[]>("/users", { token }),

  createUser: (token: string, payload: CreateUserPayload) =>
    request<User>("/users", {
      method: "POST",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  updateUser: (token: string, userId: string, payload: UpdateUserPayload) =>
    request<User>(`/users/${userId}`, {
      method: "PUT",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  updateUserRole: (token: string, userId: string, role: User["role"]) =>
    request<User>(`/users/${userId}/role`, {
      method: "PATCH",
      token,
      body: { role },
    }),

  deleteUser: (token: string, userId: string) =>
    request<{ message: string }>(`/users/${userId}`, {
      method: "DELETE",
      token,
    }),

  exportBackup: (token: string) => request<Record<string, unknown>>("/backups/export", { token }),
};