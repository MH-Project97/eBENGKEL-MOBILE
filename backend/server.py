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
    category: str
    price: float = Field(ge=0)
    stock: int = Field(ge=0)
    supplier: str
    item_code: str
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

    user_public = UserPublic(
        id=user_document["id"],
        username=user_document["username"],
        full_name=user_document["full_name"],
        email=user_document["email"],
        role=user_document["role"],
        created_at=user_document["created_at"],
    )
    token = create_token(user_public.id, user_public.username, user_public.role)
    return AuthResponse(access_token=token, user=user_public)


@api_router.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: LoginRequest) -> AuthResponse:
    user = await get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")

    user_public = UserPublic(
        id=user["id"],
        username=user["username"],
        full_name=user["full_name"],
        email=user.get("email"),
        role=user["role"],
        created_at=user["created_at"],
    )
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
        low_stock_items=[InventoryItem(**item) for item in low_stock_items_raw],
        recent_transactions=[TransactionRecord(**item) for item in recent_transactions_raw],
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
    return UserPublic(
        id=user_document["id"],
        username=user_document["username"],
        full_name=user_document["full_name"],
        email=user_document["email"],
        role=user_document["role"],
        created_at=user_document["created_at"],
    )


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
                {"category": {"$regex": q, "$options": "i"}},
                {"item_code": {"$regex": q, "$options": "i"}},
                {"supplier": {"$regex": q, "$options": "i"}},
            ]
        }
    items = await db.inventory.find(filters, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [InventoryItem(**item) for item in items]


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
        category=payload.category.strip(),
        price=payload.price,
        stock=payload.stock,
        supplier=payload.supplier.strip(),
        item_code=payload.item_code.strip().upper(),
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
        category=payload.category.strip(),
        price=payload.price,
        stock=payload.stock,
        supplier=payload.supplier.strip(),
        item_code=payload.item_code.strip().upper(),
        low_stock_threshold=payload.low_stock_threshold,
        created_at=existing_item["created_at"],
        updated_at=now_iso(),
    )
    await db.inventory.update_one({"id": item_id}, {"$set": updated_item.model_dump()})
    return updated_item


@api_router.get("/transactions", response_model=list[TransactionRecord])
async def list_transactions(current_user: dict = Depends(get_current_user)) -> list[TransactionRecord]:
    transactions = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return [TransactionRecord(**transaction) for transaction in transactions]


@api_router.post("/transactions", response_model=TransactionRecord)
async def create_transaction(
    payload: TransactionCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> TransactionRecord:
    if current_user["role"] == "mekanik":
        raise HTTPException(status_code=403, detail="Role mekanik tidak bisa membuat transaksi")

    if not payload.lines:
        raise HTTPException(status_code=400, detail="Tambahkan minimal satu barang atau jasa")

    transaction_lines: list[TransactionLine] = []
    inventory_updates: list[tuple[str, int]] = []
    subtotal = 0.0

    for line in payload.lines:
        item_name = line.name.strip()
        unit_price = float(line.unit_price)
        if line.type == "barang":
            if not line.item_id:
                raise HTTPException(status_code=400, detail="Barang harus memiliki item_id")
            item = await db.inventory.find_one({"id": line.item_id}, {"_id": 0})
            if not item:
                raise HTTPException(status_code=404, detail=f"Barang untuk {item_name} tidak ditemukan")
            if item["stock"] < line.quantity:
                raise HTTPException(status_code=400, detail=f"Stok {item['name']} tidak cukup")
            item_name = item["name"]
            unit_price = float(item["price"])
            inventory_updates.append((item["id"], item["stock"] - line.quantity))

        line_total = round(unit_price * line.quantity, 2)
        subtotal += line_total
        transaction_lines.append(
            TransactionLine(
                item_id=line.item_id,
                type=line.type,
                name=item_name,
                quantity=line.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    total = round(max(subtotal - payload.discount, 0), 2)
    timestamp = now_iso()
    transaction = TransactionRecord(
        id=str(uuid.uuid4()),
        invoice_number=(payload.invoice_number or generate_invoice_number()).strip(),
        transaction_date=timestamp,
        customer_name=payload.customer_name.strip(),
        mechanic_name=payload.mechanic_name.strip(),
        notes=payload.notes.strip(),
        payment_method=payload.payment_method,
        status=payload.status,
        discount=round(payload.discount, 2),
        subtotal=round(subtotal, 2),
        total=total,
        lines=transaction_lines,
        created_by_name=current_user["full_name"],
        created_by_role=current_user["role"],
        created_at=timestamp,
    )

    await db.transactions.insert_one(transaction.model_dump())
    for item_id, new_stock in inventory_updates:
        await db.inventory.update_one(
            {"id": item_id},
            {"$set": {"stock": new_stock, "updated_at": timestamp}},
        )

    return transaction


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
