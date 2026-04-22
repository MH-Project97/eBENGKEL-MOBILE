export type Role = "admin" | "kasir" | "mekanik";

export type User = {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  role: Role;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type WorkshopProfile = {
  id: string;
  workshop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  open_hours: string;
  notes: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  supplier: string;
  item_code: string;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
};

export type TransactionLineInput = {
  item_id?: string | null;
  type: "barang" | "jasa";
  name: string;
  quantity: number;
  unit_price: number;
};

export type TransactionLine = TransactionLineInput & {
  line_total: number;
};

export type TransactionRecord = {
  id: string;
  invoice_number: string;
  transaction_date: string;
  customer_name: string;
  mechanic_name: string;
  notes: string;
  payment_method: string;
  status: string;
  discount: number;
  subtotal: number;
  total: number;
  lines: TransactionLine[];
  created_by_name: string;
  created_by_role: string;
  created_at: string;
};

export type DashboardSummary = {
  total_inventory_items: number;
  low_stock_count: number;
  total_transactions: number;
  today_revenue: number;
  low_stock_items: InventoryItem[];
  recent_transactions: TransactionRecord[];
};

export type Session = {
  token: string;
  user: User;
};