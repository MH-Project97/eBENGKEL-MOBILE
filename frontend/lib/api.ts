import Constants from "expo-constants";

import type {
  AuthResponse,
  DashboardSummary,
  InventoryItem,
  RegisterResponse,
  TransactionLineInput,
  TransactionRecord,
  User,
  WorkshopAccess,
  WorkshopMember,
  WorkshopProfile,
} from "./types";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
};

type RegisterPayload = {
  account_type: "owner" | "employee";
  username: string;
  full_name: string;
  password: string;
  email?: string;
  workshop_name?: string;
  workshop_code?: string;
};

type WorkshopPayload = {
  workshop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  open_hours: string;
  notes: string;
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

function formatApiErrorDetail(detail: unknown) {
  if (!detail) {
    return "Terjadi kesalahan";
  }
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }
        return JSON.stringify(item);
      })
      .join(" ");
  }
  if (typeof detail === "object" && detail !== null && "msg" in detail && typeof detail.msg === "string") {
    return detail.msg;
  }
  return String(detail);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.token),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({ detail: "Terjadi kesalahan" }))) as {
      detail?: unknown;
    };
    throw new Error(formatApiErrorDetail(errorData.detail));
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
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: payload,
    }),

  me: (token: string) => request<User>("/auth/me", { token }),

  switchWorkshop: (token: string, workshopId: string) =>
    request<AuthResponse>("/auth/switch-workshop", {
      method: "POST",
      token,
      body: { workshop_id: workshopId },
    }),

  getDashboardSummary: (token: string) => request<DashboardSummary>("/dashboard/summary", { token }),

  getWorkshops: (token: string) => request<WorkshopAccess[]>("/workshops", { token }),

  createWorkshop: (token: string, payload: WorkshopPayload) =>
    request<AuthResponse>("/workshops", {
      method: "POST",
      token,
      body: payload as unknown as Record<string, unknown>,
    }),

  getWorkshop: (token: string) => request<WorkshopProfile>("/workshop", { token }),

  updateWorkshop: (token: string, payload: WorkshopPayload) =>
    request<WorkshopProfile>("/workshop", {
      method: "PUT",
      token,
      body: payload,
    }),

  updateWorkshopMember: (
    token: string,
    membershipId: string,
    payload: { action: "approve" | "remove" | "set-role"; role?: "admin" | "kasir" | "mekanik" },
  ) =>
    request<{ message: string }>(`/workshop/members/${membershipId}`, {
      method: "PATCH",
      token,
      body: payload,
    }),

  addWorkshopCustomer: (token: string, name: string) =>
    request<{ message: string }>("/workshop/customers", {
      method: "POST",
      token,
      body: { name },
    }),

  addWorkshopMechanic: (token: string, name: string) =>
    request<{ message: string }>("/workshop/mechanics", {
      method: "POST",
      token,
      body: { name },
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

  getUsers: (token: string) => request<WorkshopMember[]>("/users", { token }),

  updateUserRole: (token: string, membershipId: string, role: "admin" | "kasir" | "mekanik") =>
    request<{ message: string }>(`/users/${membershipId}/role`, {
      method: "PATCH",
      token,
      body: { role },
    }),

  deleteUser: (token: string, membershipId: string) =>
    request<{ message: string }>(`/users/${membershipId}`, {
      method: "DELETE",
      token,
    }),

  exportBackup: (token: string) => request<Record<string, unknown>>("/backups/export", { token }),
};