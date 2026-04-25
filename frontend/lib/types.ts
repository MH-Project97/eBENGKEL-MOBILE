export type Role = "owner" | "admin" | "kasir" | "mekanik";

export type WorkshopAccess = {
  workshop_id: string;
  workshop_name: string;
  workshop_code: string;
  role: Role;
  status: "active" | "pending";
  is_owner: boolean;
};

export type User = {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  role: Role;
  created_at: string;
  workshop_id: string;
  workshop_name: string;
  workshop_code: string;
  workshops: WorkshopAccess[];
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type RegisterResponse = {
  message: string;
  requires_approval: boolean;
  access_token?: string | null;
  token_type?: string;
  user?: User | null;
};

export type WorkshopMember = {
  membership_id: string;
  user_id: string;
  username: string;
  full_name: string;
  email?: string | null;
  role: Role;
  status: "active" | "pending";
  created_at: string;
};

export type WorkshopProfile = {
  id: string;
  workshop_name: string;
  owner_name: string;
  workshop_code: string;
  phone: string;
  address: string;
  open_hours: string;
  notes: string;
  created_at: string;
  updated_at: string;
  customers: string[];
  manual_mechanics: string[];
  mechanic_options: string[];
  members: WorkshopMember[];
  pending_members: WorkshopMember[];
  workshops: WorkshopAccess[];
};

export type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  item_code: string;
  unit: string;
  cost_price: number;
  workshop_price: number;
  consumer_price: number;
  notes: string;
  price: number;
  category: string;
  supplier: string;
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
  customer_mode: "konsumen" | "bengkel";
  customer_name: string;
  mechanic_name: string;
  notes: string;
  payment_method: string;
  status: string;
  payment_state: "hutang" | "lunas" | "kembalian";
  discount: number;
  subtotal: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  change_due: number;
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