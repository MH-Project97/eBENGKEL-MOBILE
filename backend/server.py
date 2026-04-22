import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "test_database")]

JWT_SECRET = os.environ.get("JWT_SECRET", "bengkel-super-secret-key")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Bengkel Management API")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_username(username: str) -> str:
    return username.strip().lower()


def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_invoice_number() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"INV-{timestamp}"


class ApiMessage(BaseModel):
    message: str


class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[EmailStr] = None
    role: Literal["admin", "kasir", "mekanik"] = "kasir"


class UserPublic(UserBase):
    id: str
    created_at: str


class RegisterRequest(BaseModel):
    username: str
    full_name: str
    password: str = Field(min_length=6)
    email: Optional[EmailStr] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreateByAdmin(RegisterRequest):
    role: Literal["admin", "kasir", "mekanik"]


class UserUpdateByAdmin(BaseModel):
    username: str
    full_name: str
    email: Optional[EmailStr] = None
    role: Literal["admin", "kasir", "mekanik"]
    password: Optional[str] = Field(default=None, min_length=6)


class RoleUpdateRequest(BaseModel):
    role: Literal["admin", "kasir", "mekanik"]


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class WorkshopProfile(BaseModel):
    id: str = "workshop-profile"
    workshop_name: str = ""
    owner_name: str = ""
    phone: str = ""
    address: str = ""
    open_hours: str = ""
    notes: str = ""
    updated_at: str = Field(default_factory=now_iso)


class WorkshopUpdateRequest(BaseModel):
    workshop_name: str = ""
    owner_name: str = ""
    phone: str = ""
    address: str = ""
    open_hours: str = ""
    notes: str = ""


class InventoryItemBase(BaseModel):
    name: str
    stock: int = Field(ge=0)
    item_code: str
    unit: str = "pcs"
    cost_price: float = Field(default=0, ge=0)
    workshop_price: float = Field(default=0, ge=0)
    consumer_price: float = Field(default=0, ge=0)
    notes: str = ""
    price: float = Field(default=0, ge=0)
    category: str = ""
    supplier: str = ""
    low_stock_threshold: int = Field(default=5, ge=0)


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(InventoryItemBase):
    pass


class InventoryItem(InventoryItemBase):
    id: str
    created_at: str
    updated_at: str


class TransactionLineInput(BaseModel):
    item_id: Optional[str] = None
    type: Literal["barang", "jasa"]
    name: str
    quantity: int = Field(ge=1)
    unit_price: float = Field(ge=0)


class TransactionLine(TransactionLineInput):
    line_total: float


class TransactionCreateRequest(BaseModel):
    customer_name: str = ""
    mechanic_name: str = ""
    notes: str = ""
    payment_method: Literal["tunai", "transfer", "kartu", "qris"] = "tunai"
    status: Literal["paid", "unpaid"] = "paid"
    discount: float = Field(default=0, ge=0)
    amount_paid: float = Field(default=0, ge=0)
    invoice_number: Optional[str] = None
    lines: list[TransactionLineInput] = Field(default_factory=list)


class TransactionRecord(BaseModel):
    id: str
    invoice_number: str
    transaction_date: str
    customer_name: str
    mechanic_name: str
    notes: str
    payment_method: str
    status: str
    discount: float
    subtotal: float
    total: float
    amount_paid: float = 0
    payment_state: Literal["hutang", "lunas", "kembalian"] = "hutang"
    balance_due: float = 0
    change_due: float = 0
    lines: list[TransactionLine]
    created_by_name: str
    created_by_role: str
    created_at: str


class DashboardSummary(BaseModel):
    total_inventory_items: int
    low_stock_count: int
    total_transactions: int
    today_revenue: float
    low_stock_items: list[InventoryItem]
    recent_transactions: list[TransactionRecord]


async def get_user_by_username(username: str) -> Optional[dict]:
    return await db.users.find_one({"username": normalize_username(username)})


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def build_user_public(user_document: dict) -> UserPublic:
    return UserPublic(
        id=user_document["id"],
        username=user_document["username"],
        full_name=user_document["full_name"],
        email=user_document.get("email"),
        role=user_document["role"],
        created_at=user_document["created_at"],
    )


def parse_date_boundary(date_value: str, is_end: bool = False) -> str:
    date_part = datetime.strptime(date_value[:10], "%Y-%m-%d")
    normalized = date_part.replace(tzinfo=timezone.utc)
    if is_end:
        normalized = normalized + timedelta(days=1) - timedelta(microseconds=1)
    return normalized.isoformat()


async def restore_inventory_stock(previous_lines: list[dict], timestamp: str) -> None:
    for line in previous_lines:
        if line.get("type") != "barang" or not line.get("item_id"):
            continue

        item = await db.inventory.find_one({"id": line["item_id"]}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail=f"Barang terkait transaksi tidak ditemukan: {line['name']}")

        await db.inventory.update_one(
            {"id": item["id"]},
            {"$set": {"stock": item["stock"] + int(line["quantity"]), "updated_at": timestamp}},
        )


async def build_transaction_lines_and_stock(
    new_lines: list[TransactionLineInput],
    previous_lines: Optional[list[dict]] = None,
) -> tuple[list[TransactionLine], dict[str, int], float]:
    if not new_lines:
        raise HTTPException(status_code=400, detail="Tambahkan minimal satu barang atau jasa")

    previous_lines = previous_lines or []
    involved_item_ids = {
        line["item_id"]
        for line in previous_lines
        if line.get("type") == "barang" and line.get("item_id")
    }
    involved_item_ids.update(
        line.item_id for line in new_lines if line.type == "barang" and line.item_id
    )

    item_map: dict[str, dict] = {}
    if involved_item_ids:
        items = await db.inventory.find(
            {"id": {"$in": list(involved_item_ids)}},
            {"_id": 0},
        ).to_list(len(involved_item_ids))
        item_map = {item["id"]: item for item in items}
        if len(item_map) != len(involved_item_ids):
            raise HTTPException(status_code=404, detail="Ada barang transaksi yang sudah tidak tersedia")

    available_stock = {item_id: item["stock"] for item_id, item in item_map.items()}
    for old_line in previous_lines:
        if old_line.get("type") == "barang" and old_line.get("item_id"):
            available_stock[old_line["item_id"]] = available_stock.get(old_line["item_id"], 0) + int(old_line["quantity"])

    transaction_lines: list[TransactionLine] = []
    subtotal = 0.0

    for line in new_lines:
        item_name = line.name.strip()
        unit_price = float(line.unit_price)
        item_id = line.item_id

        if line.type == "barang":
            if not item_id:
                raise HTTPException(status_code=400, detail="Barang harus memiliki item_id")
            item = item_map.get(item_id)
            if not item:
                raise HTTPException(status_code=404, detail=f"Barang untuk {item_name} tidak ditemukan")
            if available_stock[item_id] < line.quantity:
                raise HTTPException(status_code=400, detail=f"Stok {item['name']} tidak cukup")
            available_stock[item_id] -= line.quantity
            item_name = item["name"]
            unit_price = float(item["price"])

        line_total = round(unit_price * line.quantity, 2)
        subtotal += line_total
        transaction_lines.append(
            TransactionLine(
                item_id=item_id,
                type=line.type,
                name=item_name,
                quantity=line.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    return transaction_lines, available_stock, round(subtotal, 2)


async def apply_inventory_stock_updates(stock_updates: dict[str, int], timestamp: str) -> None:
    for item_id, new_stock in stock_updates.items():
        await db.inventory.update_one(
            {"id": item_id},
            {"$set": {"stock": new_stock, "updated_at": timestamp}},
        )


def normalize_inventory_item_document(document: dict) -> dict:
    normalized = {**document}
    base_price = float(normalized.get("price", normalized.get("consumer_price", 0)))
    normalized["unit"] = normalized.get("unit") or "pcs"
    normalized["cost_price"] = float(normalized.get("cost_price", 0))
    normalized["workshop_price"] = float(normalized.get("workshop_price", base_price))
    normalized["consumer_price"] = float(normalized.get("consumer_price", base_price))
    normalized["notes"] = normalized.get("notes", "")
    normalized["price"] = float(normalized.get("consumer_price", base_price))
    normalized["category"] = normalized.get("category", "")
    normalized["supplier"] = normalized.get("supplier", "")
    return normalized


def derive_payment_fields(total: float, amount_paid: float) -> dict:
    normalized_paid = round(amount_paid, 2)
    if normalized_paid < total:
        return {
            "status": "unpaid",
            "payment_state": "hutang",
            "amount_paid": normalized_paid,
            "balance_due": round(total - normalized_paid, 2),
            "change_due": 0.0,
        }
    if normalized_paid > total:
        return {
            "status": "paid",
            "payment_state": "kembalian",
            "amount_paid": normalized_paid,
            "balance_due": 0.0,
            "change_due": round(normalized_paid - total, 2),
        }
    return {
        "status": "paid",
        "payment_state": "lunas",
        "amount_paid": normalized_paid,
        "balance_due": 0.0,
        "change_due": 0.0,
    }


def normalize_transaction_document(document: dict) -> dict:
    normalized = {**document}
    total = round(float(normalized.get("total", 0)), 2)
    if "amount_paid" not in normalized:
        if normalized.get("status") == "paid":
            normalized["amount_paid"] = total
            normalized["payment_state"] = "lunas"
            normalized["balance_due"] = 0.0
            normalized["change_due"] = 0.0
        else:
            normalized["amount_paid"] = 0.0
            normalized["payment_state"] = "hutang"
            normalized["balance_due"] = total
            normalized["change_due"] = 0.0
        return normalized

    payment_fields = derive_payment_fields(total, float(normalized.get("amount_paid", 0)))
    normalized.update(payment_fields)
    return normalized


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Silakan login terlebih dahulu")

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token tidak valid") from exc

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token tidak valid")

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Pengguna tidak ditemukan")
    return user


async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya admin yang boleh melakukan aksi ini")
    return current_user


async def ensure_workshop_profile() -> None:
    existing = await db.workshop.find_one({"id": "workshop-profile"}, {"_id": 0})
    if not existing:
        profile = WorkshopProfile().model_dump()
        await db.workshop.insert_one(profile)


async def seed_default_users() -> None:
    user_count = await db.users.count_documents({})
    if user_count > 0:
        return

    created_at = now_iso()
    default_users = [
        {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "full_name": "Admin Bengkel",
            "email": "admin@bengkel.app",
            "role": "admin",
            "password_hash": hash_password("admin123"),
            "created_at": created_at,
        },
        {
            "id": str(uuid.uuid4()),
            "username": "kasir",
            "full_name": "Kasir Bengkel",
            "email": "kasir@bengkel.app",
            "role": "kasir",
            "password_hash": hash_password("kasir123"),
            "created_at": created_at,
        },
        {
            "id": str(uuid.uuid4()),
            "username": "mekanik",
            "full_name": "Mekanik Bengkel",
            "email": "mekanik@bengkel.app",
            "role": "mekanik",
            "password_hash": hash_password("mekanik123"),
            "created_at": created_at,
        },
    ]
    await db.users.insert_many(default_users)


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_workshop_profile()
    await seed_default_users()


@api_router.get("/")
async def root() -> dict:
    return {"message": "Bengkel Management API aktif"}


@api_router.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "timestamp": now_iso()}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register_user(payload: RegisterRequest) -> AuthResponse:
    normalized_username = normalize_username(payload.username)
    existing_user = await get_user_by_username(normalized_username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")

    role = "kasir"
    user_count = await db.users.count_documents({})
    if user_count == 0:
        role = "admin"

    user_document = {
        "id": str(uuid.uuid4()),
        "username": normalized_username,
        "full_name": payload.full_name.strip(),
        "email": payload.email,
        "role": role,
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_document)

    user_public = build_user_public(user_document)
    token = create_token(user_public.id, user_public.username, user_public.role)
    return AuthResponse(access_token=token, user=user_public)


@api_router.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: LoginRequest) -> AuthResponse:
    user = await get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")

    user_public = build_user_public(user)
    token = create_token(user_public.id, user_public.username, user_public.role)
    return AuthResponse(access_token=token, user=user_public)


@api_router.get("/auth/me", response_model=UserPublic)
async def read_me(current_user: dict = Depends(get_current_user)) -> UserPublic:
    return UserPublic(**current_user)


@api_router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)) -> DashboardSummary:
    total_inventory_items = await db.inventory.count_documents({})
    total_transactions = await db.transactions.count_documents({})
    low_stock_items_raw = await db.inventory.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}},
        {"_id": 0},
    ).sort("updated_at", 1).to_list(5)
    recent_transactions_raw = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    today_transactions = await db.transactions.find(
        {"transaction_date": {"$regex": f"^{today_prefix}"}},
        {"_id": 0, "total": 1},
    ).to_list(200)
    today_revenue = round(sum(item.get("total", 0) for item in today_transactions), 2)

    return DashboardSummary(
        total_inventory_items=total_inventory_items,
        low_stock_count=len(low_stock_items_raw),
        total_transactions=total_transactions,
        today_revenue=today_revenue,
        low_stock_items=[InventoryItem(**normalize_inventory_item_document(item)) for item in low_stock_items_raw],
        recent_transactions=[TransactionRecord(**normalize_transaction_document(item)) for item in recent_transactions_raw],
    )


@api_router.get("/workshop", response_model=WorkshopProfile)
async def read_workshop(current_user: dict = Depends(get_current_user)) -> WorkshopProfile:
    profile = await db.workshop.find_one({"id": "workshop-profile"}, {"_id": 0})
    return WorkshopProfile(**(profile or WorkshopProfile().model_dump()))


@api_router.put("/workshop", response_model=WorkshopProfile)
async def update_workshop(
    payload: WorkshopUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> WorkshopProfile:
    profile = WorkshopProfile(updated_at=now_iso(), **payload.model_dump())
    await db.workshop.update_one(
        {"id": "workshop-profile"},
        {"$set": profile.model_dump()},
        upsert=True,
    )
    return profile


@api_router.get("/users", response_model=list[UserPublic])
async def list_users(current_user: dict = Depends(get_current_user)) -> list[UserPublic]:
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(100)
    return [UserPublic(**user) for user in users]


@api_router.post("/users", response_model=UserPublic)
async def create_user_by_admin(
    payload: UserCreateByAdmin,
    admin_user: dict = Depends(get_admin_user),
) -> UserPublic:
    normalized_username = normalize_username(payload.username)
    existing_user = await get_user_by_username(normalized_username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")

    user_document = {
        "id": str(uuid.uuid4()),
        "username": normalized_username,
        "full_name": payload.full_name.strip(),
        "email": payload.email,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_document)
    return build_user_public(user_document)


@api_router.patch("/users/{user_id}/role", response_model=UserPublic)
async def update_user_role(
    user_id: str,
    payload: RoleUpdateRequest,
    admin_user: dict = Depends(get_admin_user),
) -> UserPublic:
    existing_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")

    await db.users.update_one({"id": user_id}, {"$set": {"role": payload.role}})
    updated_user = {**existing_user, "role": payload.role}
    return UserPublic(**updated_user)


@api_router.put("/users/{user_id}", response_model=UserPublic)
async def update_user_by_admin(
    user_id: str,
    payload: UserUpdateByAdmin,
    admin_user: dict = Depends(get_admin_user),
) -> UserPublic:
    existing_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")

    normalized_username = normalize_username(payload.username)
    duplicate_user = await db.users.find_one(
        {"username": normalized_username, "id": {"$ne": user_id}},
        {"_id": 0},
    )
    if duplicate_user:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")

    updated_document = {
        "id": user_id,
        "username": normalized_username,
        "full_name": payload.full_name.strip(),
        "email": payload.email,
        "role": payload.role,
        "created_at": existing_user["created_at"],
        "password_hash": existing_user["password_hash"],
    }
    if payload.password:
        updated_document["password_hash"] = hash_password(payload.password)

    await db.users.update_one({"id": user_id}, {"$set": updated_document})
    return build_user_public(updated_document)


@api_router.delete("/users/{user_id}", response_model=ApiMessage)
async def delete_user_by_admin(
    user_id: str,
    admin_user: dict = Depends(get_admin_user),
) -> ApiMessage:
    if admin_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Admin tidak bisa menghapus akunnya sendiri")

    existing_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")

    await db.users.delete_one({"id": user_id})
    return ApiMessage(message="Pengguna berhasil dihapus")


@api_router.get("/items", response_model=list[InventoryItem])
async def list_items(
    q: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
) -> list[InventoryItem]:
    filters = {}
    if q.strip():
        filters = {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"item_code": {"$regex": q, "$options": "i"}},
                {"notes": {"$regex": q, "$options": "i"}},
                {"unit": {"$regex": q, "$options": "i"}},
            ]
        }
    items = await db.inventory.find(filters, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [InventoryItem(**normalize_inventory_item_document(item)) for item in items]


@api_router.post("/items", response_model=InventoryItem)
async def create_item(
    payload: InventoryItemCreate,
    current_user: dict = Depends(get_current_user),
) -> InventoryItem:
    existing_item = await db.inventory.find_one({"item_code": payload.item_code.strip().upper()}, {"_id": 0})
    if existing_item:
        raise HTTPException(status_code=400, detail="Kode barang sudah dipakai")

    timestamp = now_iso()
    item = InventoryItem(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        stock=payload.stock,
        item_code=payload.item_code.strip().upper(),
        unit=payload.unit.strip().lower(),
        cost_price=payload.cost_price,
        workshop_price=payload.workshop_price,
        consumer_price=payload.consumer_price,
        notes=payload.notes.strip(),
        price=payload.consumer_price,
        category=payload.category.strip(),
        supplier=payload.supplier.strip(),
        low_stock_threshold=payload.low_stock_threshold,
        created_at=timestamp,
        updated_at=timestamp,
    )
    await db.inventory.insert_one(item.model_dump())
    return item


@api_router.put("/items/{item_id}", response_model=InventoryItem)
async def update_item(
    item_id: str,
    payload: InventoryItemUpdate,
    current_user: dict = Depends(get_current_user),
) -> InventoryItem:
    existing_item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")

    duplicate_item = await db.inventory.find_one(
        {"item_code": payload.item_code.strip().upper(), "id": {"$ne": item_id}},
        {"_id": 0},
    )
    if duplicate_item:
        raise HTTPException(status_code=400, detail="Kode barang sudah dipakai")

    updated_item = InventoryItem(
        id=item_id,
        name=payload.name.strip(),
        stock=payload.stock,
        item_code=payload.item_code.strip().upper(),
        unit=payload.unit.strip().lower(),
        cost_price=payload.cost_price,
        workshop_price=payload.workshop_price,
        consumer_price=payload.consumer_price,
        notes=payload.notes.strip(),
        price=payload.consumer_price,
        category=payload.category.strip(),
        supplier=payload.supplier.strip(),
        low_stock_threshold=payload.low_stock_threshold,
        created_at=existing_item["created_at"],
        updated_at=now_iso(),
    )
    await db.inventory.update_one({"id": item_id}, {"$set": updated_item.model_dump()})
    return updated_item


@api_router.delete("/items/{item_id}", response_model=ApiMessage)
async def delete_item(
    item_id: str,
    admin_user: dict = Depends(get_admin_user),
) -> ApiMessage:
    existing_item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")

    transaction_usage = await db.transactions.count_documents({"lines": {"$elemMatch": {"item_id": item_id}}})
    if transaction_usage > 0:
        raise HTTPException(status_code=400, detail="Barang sudah dipakai di transaksi dan tidak bisa dihapus")

    await db.inventory.delete_one({"id": item_id})
    return ApiMessage(message="Barang berhasil dihapus")


@api_router.get("/transactions", response_model=list[TransactionRecord])
async def list_transactions(
    start_date: str = Query(default=""),
    end_date: str = Query(default=""),
    status_filter: str = Query(default="", alias="status"),
    mechanic_name: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
) -> list[TransactionRecord]:
    filters: dict = {}
    transaction_date_filter: dict = {}

    if start_date.strip():
        transaction_date_filter["$gte"] = parse_date_boundary(start_date)
    if end_date.strip():
        transaction_date_filter["$lte"] = parse_date_boundary(end_date, is_end=True)
    if transaction_date_filter:
        filters["transaction_date"] = transaction_date_filter

    if status_filter.strip() in {"paid", "unpaid"}:
        filters["status"] = status_filter.strip()

    if mechanic_name.strip():
        filters["mechanic_name"] = {"$regex": mechanic_name.strip(), "$options": "i"}

    transactions = await db.transactions.find(filters, {"_id": 0}).sort("created_at", -1).to_list(300)
    return [TransactionRecord(**normalize_transaction_document(transaction)) for transaction in transactions]


@api_router.get("/transactions/{transaction_id}", response_model=TransactionRecord)
async def get_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
) -> TransactionRecord:
    transaction = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return TransactionRecord(**normalize_transaction_document(transaction))


@api_router.post("/transactions", response_model=TransactionRecord)
async def create_transaction(
    payload: TransactionCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> TransactionRecord:
    if current_user["role"] == "mekanik":
        raise HTTPException(status_code=403, detail="Role mekanik tidak bisa membuat transaksi")

    transaction_lines, inventory_updates, subtotal = await build_transaction_lines_and_stock(payload.lines)

    total = round(max(subtotal - payload.discount, 0), 2)
    timestamp = now_iso()
    payment_fields = derive_payment_fields(total, payload.amount_paid)
    transaction = TransactionRecord(
        id=str(uuid.uuid4()),
        invoice_number=(payload.invoice_number or generate_invoice_number()).strip(),
        transaction_date=timestamp,
        customer_name=payload.customer_name.strip(),
        mechanic_name=payload.mechanic_name.strip(),
        notes=payload.notes.strip(),
        payment_method=payload.payment_method,
        status=payment_fields["status"],
        discount=round(payload.discount, 2),
        subtotal=round(subtotal, 2),
        total=total,
        amount_paid=payment_fields["amount_paid"],
        payment_state=payment_fields["payment_state"],
        balance_due=payment_fields["balance_due"],
        change_due=payment_fields["change_due"],
        lines=transaction_lines,
        created_by_name=current_user["full_name"],
        created_by_role=current_user["role"],
        created_at=timestamp,
    )

    await db.transactions.insert_one(transaction.model_dump())
    await apply_inventory_stock_updates(inventory_updates, timestamp)

    return transaction


@api_router.put("/transactions/{transaction_id}", response_model=TransactionRecord)
async def update_transaction(
    transaction_id: str,
    payload: TransactionCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> TransactionRecord:
    if current_user["role"] == "mekanik":
        raise HTTPException(status_code=403, detail="Role mekanik tidak bisa mengubah transaksi")

    existing_transaction = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not existing_transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    transaction_lines, inventory_updates, subtotal = await build_transaction_lines_and_stock(
        payload.lines,
        existing_transaction["lines"],
    )
    total = round(max(subtotal - payload.discount, 0), 2)
    timestamp = now_iso()
    payment_fields = derive_payment_fields(total, payload.amount_paid)
    updated_transaction = TransactionRecord(
        id=transaction_id,
        invoice_number=(payload.invoice_number or existing_transaction["invoice_number"]).strip(),
        transaction_date=existing_transaction["transaction_date"],
        customer_name=payload.customer_name.strip(),
        mechanic_name=payload.mechanic_name.strip(),
        notes=payload.notes.strip(),
        payment_method=payload.payment_method,
        status=payment_fields["status"],
        discount=round(payload.discount, 2),
        subtotal=subtotal,
        total=total,
        amount_paid=payment_fields["amount_paid"],
        payment_state=payment_fields["payment_state"],
        balance_due=payment_fields["balance_due"],
        change_due=payment_fields["change_due"],
        lines=transaction_lines,
        created_by_name=existing_transaction["created_by_name"],
        created_by_role=existing_transaction["created_by_role"],
        created_at=existing_transaction["created_at"],
    )

    await db.transactions.update_one({"id": transaction_id}, {"$set": updated_transaction.model_dump()})
    await apply_inventory_stock_updates(inventory_updates, timestamp)
    return updated_transaction


@api_router.delete("/transactions/{transaction_id}", response_model=ApiMessage)
async def delete_transaction(
    transaction_id: str,
    admin_user: dict = Depends(get_admin_user),
) -> ApiMessage:
    existing_transaction = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not existing_transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    timestamp = now_iso()
    await restore_inventory_stock(existing_transaction["lines"], timestamp)
    await db.transactions.delete_one({"id": transaction_id})
    return ApiMessage(message="Transaksi berhasil dihapus")


@api_router.get("/backups/export")
async def export_backup_data(admin_user: dict = Depends(get_admin_user)) -> dict:
    workshop = await db.workshop.find_one({"id": "workshop-profile"}, {"_id": 0})
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(200)
    inventory_items = await db.inventory.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    transactions = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

    normalized_transactions = [normalize_transaction_document(transaction) for transaction in transactions]
    return {
        "exported_at": now_iso(),
        "workshop": workshop or WorkshopProfile().model_dump(),
        "users": users,
        "inventory_items": inventory_items,
        "transactions": normalized_transactions,
        "counts": {
            "users": len(users),
            "inventory_items": len(inventory_items),
            "transactions": len(normalized_transactions),
        },
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()
