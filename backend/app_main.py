import logging
import os
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "test_database")]

JWT_SECRET = os.environ.get("JWT_SECRET", "bengkel-multi-workshop-secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
REFRESH_TOKEN_EXPIRE_DAYS = 30
WORKSHOP_CODE_LENGTH = 18
FAILED_LOGIN_THRESHOLD = 5
LOCKOUT_MINUTES = 15
security = HTTPBearer(auto_error=False)

Role = Literal["owner", "admin", "kasir", "mekanik"]
StaffRole = Literal["admin", "kasir", "mekanik"]
MembershipStatus = Literal["active", "pending"]

app = FastAPI(title="Bengkel Management API")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_username(username: str) -> str:
    return username.strip().lower()


def normalize_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    normalized = email.strip().lower()
    return normalized or None


def generate_workshop_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choices(alphabet, k=WORKSHOP_CODE_LENGTH))


def create_token(user_id: str, username: str, workshop_id: str, role: Role) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "workshop_id": workshop_id,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def generate_invoice_number() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"INV-{timestamp}"


class ApiMessage(BaseModel):
    message: str


class WorkshopAccess(BaseModel):
    workshop_id: str
    workshop_name: str
    workshop_code: str
    role: Role
    status: MembershipStatus = "active"
    is_owner: bool = False


class UserSession(BaseModel):
    id: str
    username: str
    full_name: str
    email: Optional[EmailStr] = None
    role: Role
    created_at: str
    workshop_id: str
    workshop_name: str
    workshop_code: str
    workshops: list[WorkshopAccess] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    account_type: Literal["owner", "employee"]
    username: str
    full_name: str
    password: str = Field(min_length=6)
    email: Optional[EmailStr] = None
    workshop_name: Optional[str] = None
    workshop_code: Optional[str] = None
    requested_role: Optional[StaffRole] = None


class RegisterResponse(BaseModel):
    message: str
    requires_approval: bool = False
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserSession] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSession


class SwitchWorkshopRequest(BaseModel):
    workshop_id: str


class WorkshopProfileBase(BaseModel):
    workshop_name: str = ""
    owner_name: str = ""
    phone: str = ""
    address: str = ""
    open_hours: str = ""
    notes: str = ""


class WorkshopCreateRequest(WorkshopProfileBase):
    workshop_name: str


class WorkshopUpdateRequest(WorkshopProfileBase):
    pass


class WorkshopMember(BaseModel):
    membership_id: str
    user_id: str
    username: str
    full_name: str
    email: Optional[EmailStr] = None
    role: Role
    status: MembershipStatus
    created_at: str


class WorkshopDetailResponse(WorkshopProfileBase):
    id: str
    workshop_code: str
    created_at: str
    updated_at: str
    customers: list[str] = Field(default_factory=list)
    manual_mechanics: list[str] = Field(default_factory=list)
    mechanic_options: list[str] = Field(default_factory=list)
    members: list[WorkshopMember] = Field(default_factory=list)
    pending_members: list[WorkshopMember] = Field(default_factory=list)
    workshops: list[WorkshopAccess] = Field(default_factory=list)


class MembershipActionRequest(BaseModel):
    action: Literal["approve", "remove", "set-role"]
    role: Optional[StaffRole] = None


class WorkshopMemberRoleRequest(BaseModel):
    role: StaffRole


class UserPasswordUpdateRequest(BaseModel):
    password: Optional[str] = Field(default=None, min_length=6)


class UserPasswordUpdateResponse(BaseModel):
    message: str
    username: str
    temporary_password: Optional[str] = None


class WorkshopNameCreateRequest(BaseModel):
    name: str


class MechanicAccountResponse(BaseModel):
    message: str
    created_account: bool = False
    username: Optional[str] = None


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
    workshop_id: str
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
    customer_mode: Literal["konsumen", "bengkel"] = "konsumen"
    customer_name: str = ""
    mechanic_name: str = ""
    notes: str = ""
    payment_method: Literal["tunai", "transfer", "qris"] = "tunai"
    status: Literal["paid", "unpaid"] = "paid"
    discount: float = Field(default=0, ge=0)
    amount_paid: float = Field(default=0, ge=0)
    invoice_number: Optional[str] = None
    lines: list[TransactionLineInput] = Field(default_factory=list)


class TransactionRecord(BaseModel):
    id: str
    workshop_id: str
    invoice_number: str
    transaction_date: str
    customer_mode: Literal["konsumen", "bengkel"] = "konsumen"
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
    normalized["customer_mode"] = normalized.get("customer_mode", "konsumen")
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
    normalized.update(derive_payment_fields(total, float(normalized.get("amount_paid", 0))))
    return normalized


async def ensure_indexes() -> None:
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("created_at")
    await db.workshops.create_index("workshop_code", unique=True)
    await db.workshops.create_index("owner_name")
    await db.workshop_memberships.create_index([("user_id", 1), ("workshop_id", 1)], unique=True)
    await db.workshop_memberships.create_index([("workshop_id", 1), ("status", 1)])
    await db.inventory.create_index([("workshop_id", 1), ("item_code", 1)], unique=True)
    await db.transactions.create_index([("workshop_id", 1), ("created_at", -1)])
    await db.login_attempts.create_index("identifier", unique=True)


async def seed_admin() -> None:
    admin_username = normalize_username(os.environ.get("ADMIN_USERNAME", ""))
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_full_name = os.environ.get("ADMIN_FULL_NAME", "Admin Owner")
    admin_workshop_name = os.environ.get("ADMIN_WORKSHOP_NAME", "")
    if not admin_username or not admin_password or not admin_workshop_name:
        return

    existing_user = await get_user_account_by_username(admin_username)
    timestamp = now_iso()
    if existing_user:
        if not verify_password(admin_password, existing_user["password_hash"]):
            await db.users.update_one(
                {"id": existing_user["id"]},
                {"$set": {"password_hash": hash_password(admin_password)}},
            )
        return

    workshop_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    user_document = {
        "id": user_id,
        "username": admin_username,
        "full_name": admin_full_name,
        "password_hash": hash_password(admin_password),
        "created_at": timestamp,
        "last_workshop_id": workshop_id,
    }
    workshop_document = {
        "id": workshop_id,
        "workshop_code": await generate_unique_workshop_code(),
        "workshop_name": admin_workshop_name,
        "owner_name": admin_full_name,
        "phone": "",
        "address": "",
        "open_hours": "",
        "notes": "",
        "customers": [],
        "manual_mechanics": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    membership_document = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "workshop_id": workshop_id,
        "role": "owner",
        "status": "active",
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    await db.users.insert_one({**user_document})
    await db.workshops.insert_one({**workshop_document})
    await db.workshop_memberships.insert_one({**membership_document})


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_indexes()
    await seed_admin()


async def get_user_account_by_username(username: str) -> Optional[dict]:
    return await db.users.find_one({"username": normalize_username(username)})


async def get_user_account_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


async def ensure_unique_email(email: Optional[str], exclude_user_id: Optional[str] = None) -> None:
    normalized_email = normalize_email(email)
    if not normalized_email:
        return
    filters: dict = {"email": normalized_email}
    if exclude_user_id:
        filters["id"] = {"$ne": exclude_user_id}
    existing = await db.users.find_one(filters, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah dipakai")


async def generate_unique_workshop_code() -> str:
    for _ in range(25):
        code = generate_workshop_code()
        exists = await db.workshops.find_one({"workshop_code": code}, {"_id": 0, "id": 1})
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Gagal membuat ID bengkel unik")


def normalize_person_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def build_username_seed(full_name: str) -> str:
    cleaned = "".join(character for character in full_name.lower() if character.isalnum())
    return cleaned[:10] or "mekanik"


def generate_temporary_password(length: int = 8) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choices(alphabet, k=length))


async def generate_unique_staff_username(full_name: str) -> str:
    base = build_username_seed(full_name)
    for _ in range(40):
        candidate = normalize_username(f"{base}{''.join(random.choices(string.digits, k=4))}")
        existing = await db.users.find_one({"username": candidate}, {"_id": 0, "id": 1})
        if not existing:
            return candidate
    raise HTTPException(status_code=500, detail="Gagal membuat username mekanik unik")


async def ensure_mechanic_account(workshop_id: str, mechanic_name: str) -> dict:
    normalized_name = normalize_person_name(mechanic_name)
    if not normalized_name:
        return {"created_account": False, "username": None, "full_name": ""}

    active_members = await list_workshop_members(workshop_id, "active")
    for member in active_members:
        if member.role == "mekanik" and normalize_person_name(member.full_name) == normalized_name:
            return {"created_account": False, "username": member.username, "full_name": member.full_name}

    full_name = " ".join(part.capitalize() for part in normalized_name.split())
    username = await generate_unique_staff_username(full_name)
    timestamp = now_iso()
    user_id = str(uuid.uuid4())
    temporary_password = generate_temporary_password()
    user_document = {
        "id": user_id,
        "username": username,
        "full_name": full_name,
        "password_hash": hash_password(temporary_password),
        "created_at": timestamp,
        "last_workshop_id": workshop_id,
    }
    membership_document = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "workshop_id": workshop_id,
        "role": "mekanik",
        "status": "active",
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    await db.users.insert_one({**user_document})
    await db.workshop_memberships.insert_one({**membership_document})

    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    if workshop:
        manual_mechanics = [
            name
            for name in workshop.get("manual_mechanics", [])
            if normalize_person_name(name) != normalized_name
        ]
        await db.workshops.update_one(
            {"id": workshop_id},
            {"$set": {"manual_mechanics": manual_mechanics, "updated_at": timestamp}},
        )

    return {"created_account": True, "username": username, "full_name": full_name}


async def get_workshop_accesses(user_id: str, statuses: Optional[list[MembershipStatus]] = None) -> list[WorkshopAccess]:
    membership_filters: dict = {"user_id": user_id}
    if statuses:
        membership_filters["status"] = {"$in": statuses}

    memberships = await db.workshop_memberships.find(membership_filters, {"_id": 0}).sort("created_at", 1).to_list(100)
    if not memberships:
        return []

    workshop_ids = [membership["workshop_id"] for membership in memberships]
    workshops = await db.workshops.find({"id": {"$in": workshop_ids}}, {"_id": 0}).to_list(len(workshop_ids))
    workshop_map = {workshop["id"]: workshop for workshop in workshops}

    accesses: list[WorkshopAccess] = []
    for membership in memberships:
        workshop = workshop_map.get(membership["workshop_id"])
        if not workshop:
            continue
        accesses.append(
            WorkshopAccess(
                workshop_id=workshop["id"],
                workshop_name=workshop["workshop_name"],
                workshop_code=workshop["workshop_code"],
                role=membership["role"],
                status=membership["status"],
                is_owner=membership["role"] == "owner",
            )
        )
    return accesses


async def build_session_user(user_document: dict, active_workshop_id: Optional[str] = None) -> UserSession:
    accesses = await get_workshop_accesses(user_document["id"], ["active"])
    if not accesses:
        raise HTTPException(status_code=403, detail="Akun ini belum memiliki akses bengkel aktif")

    chosen_access = next((access for access in accesses if access.workshop_id == active_workshop_id), accesses[0])
    return UserSession(
        id=user_document["id"],
        username=user_document["username"],
        full_name=user_document["full_name"],
        email=user_document.get("email"),
        role=chosen_access.role,
        created_at=user_document["created_at"],
        workshop_id=chosen_access.workshop_id,
        workshop_name=chosen_access.workshop_name,
        workshop_code=chosen_access.workshop_code,
        workshops=accesses,
    )


async def build_auth_response(user_document: dict, active_workshop_id: Optional[str] = None) -> AuthResponse:
    session_user = await build_session_user(user_document, active_workshop_id)
    await db.users.update_one(
        {"id": user_document["id"]},
        {"$set": {"last_workshop_id": session_user.workshop_id}},
    )
    token = create_token(session_user.id, session_user.username, session_user.workshop_id, session_user.role)
    return AuthResponse(access_token=token, user=session_user)


async def issue_auth_bundle(response: Response, user_document: dict, active_workshop_id: Optional[str] = None) -> AuthResponse:
    auth_response = await build_auth_response(user_document, active_workshop_id)
    refresh_token = create_refresh_token(auth_response.user.id)
    set_auth_cookies(response, auth_response.access_token, refresh_token)
    return auth_response


def parse_locked_until(locked_until: Optional[str]) -> Optional[datetime]:
    if not locked_until:
        return None
    return datetime.fromisoformat(locked_until)


async def ensure_login_not_locked(identifier: str) -> None:
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if not attempt:
        return
    locked_until = parse_locked_until(attempt.get("locked_until"))
    if locked_until and locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak percobaan login. Coba lagi dalam {LOCKOUT_MINUTES} menit.",
        )
    if locked_until and locked_until <= datetime.now(timezone.utc):
        await db.login_attempts.delete_one({"identifier": identifier})


async def record_failed_login(identifier: str) -> None:
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    failed_count = int(attempt.get("failed_count", 0)) + 1 if attempt else 1
    payload = {
        "identifier": identifier,
        "failed_count": failed_count,
        "last_failed_at": now_iso(),
    }
    if failed_count >= FAILED_LOGIN_THRESHOLD:
        payload["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": payload}, upsert=True)


async def clear_login_attempts(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Silakan login terlebih dahulu")

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Sesi login sudah berakhir") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Token tidak valid") from exc

    user_id = payload.get("sub")
    workshop_id = payload.get("workshop_id")
    role = payload.get("role")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Tipe token tidak valid")
    if not user_id or not workshop_id or not role:
        raise HTTPException(status_code=401, detail="Token tidak lengkap")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")

    membership = await db.workshop_memberships.find_one(
        {"user_id": user_id, "workshop_id": workshop_id, "status": "active"},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=401, detail="Akses bengkel berubah, silakan login ulang")

    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=401, detail="Bengkel aktif tidak ditemukan")

    return {
        **user,
        "role": membership["role"],
        "workshop_id": workshop["id"],
        "workshop_name": workshop["workshop_name"],
        "workshop_code": workshop["workshop_code"],
    }


async def get_manager_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Hanya owner atau admin yang boleh melakukan aksi ini")
    return current_user


async def get_owner_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Hanya owner yang boleh membuat bengkel baru")
    return current_user


def parse_date_boundary(date_value: str, is_end: bool = False) -> str:
    date_part = datetime.strptime(date_value[:10], "%Y-%m-%d")
    normalized = date_part.replace(tzinfo=timezone.utc)
    if is_end:
        normalized = normalized + timedelta(days=1) - timedelta(microseconds=1)
    return normalized.isoformat()


async def restore_inventory_stock(previous_lines: list[dict], workshop_id: str, timestamp: str) -> None:
    for line in previous_lines:
        if line.get("type") != "barang" or not line.get("item_id"):
            continue

        item = await db.inventory.find_one({"id": line["item_id"], "workshop_id": workshop_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail=f"Barang terkait transaksi tidak ditemukan: {line['name']}")

        await db.inventory.update_one(
            {"id": item["id"], "workshop_id": workshop_id},
            {"$set": {"stock": item["stock"] + int(line["quantity"]), "updated_at": timestamp}},
        )


async def build_transaction_lines_and_stock(
    workshop_id: str,
    new_lines: list[TransactionLineInput],
    customer_mode: Literal["konsumen", "bengkel"],
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
            {"id": {"$in": list(involved_item_ids)}, "workshop_id": workshop_id},
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
            unit_price = float(item["workshop_price"] if customer_mode == "bengkel" else item["consumer_price"])

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


async def apply_inventory_stock_updates(workshop_id: str, stock_updates: dict[str, int], timestamp: str) -> None:
    for item_id, new_stock in stock_updates.items():
        await db.inventory.update_one(
            {"id": item_id, "workshop_id": workshop_id},
            {"$set": {"stock": new_stock, "updated_at": timestamp}},
        )


async def list_workshop_members(workshop_id: str, status_filter: MembershipStatus) -> list[WorkshopMember]:
    memberships = await db.workshop_memberships.find(
        {"workshop_id": workshop_id, "status": status_filter},
        {"_id": 0},
    ).sort("created_at", 1).to_list(200)
    if not memberships:
        return []

    user_ids = [membership["user_id"] for membership in memberships]
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
    user_map = {user["id"]: user for user in users}

    members: list[WorkshopMember] = []
    for membership in memberships:
        user = user_map.get(membership["user_id"])
        if not user:
            continue
        members.append(
            WorkshopMember(
                membership_id=membership["id"],
                user_id=user["id"],
                username=user["username"],
                full_name=user["full_name"],
                email=user.get("email"),
                role=membership["role"],
                status=membership["status"],
                created_at=membership["created_at"],
            )
        )
    return members


def build_mechanic_options(workshop: dict, members: list[WorkshopMember]) -> list[str]:
    manual_names = workshop.get("manual_mechanics", [])
    user_names = [member.full_name for member in members if member.role == "mekanik"]
    ordered_names: list[str] = []
    for name in [*user_names, *manual_names]:
        trimmed = name.strip()
        if trimmed and trimmed not in ordered_names:
            ordered_names.append(trimmed)
    return ordered_names


@api_router.get("/")
async def root() -> dict:
    return {"message": "Bengkel Management API aktif"}


@api_router.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "timestamp": now_iso()}


@api_router.post("/auth/register", response_model=RegisterResponse)
async def register_user(payload: RegisterRequest, response: Response) -> RegisterResponse:
    normalized_username = normalize_username(payload.username)
    existing_user = await get_user_account_by_username(normalized_username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")

    await ensure_unique_email(payload.email)
    normalized_email = normalize_email(payload.email)
    created_at = now_iso()

    if payload.account_type == "employee":
        workshop_code = (payload.workshop_code or "").strip().upper()
        if not workshop_code or len(workshop_code) != WORKSHOP_CODE_LENGTH or not workshop_code.isalnum():
            raise HTTPException(status_code=400, detail="Masukkan ID bengkel 18 karakter yang valid")

        workshop = await db.workshops.find_one({"workshop_code": workshop_code}, {"_id": 0})
        if not workshop:
            raise HTTPException(status_code=404, detail="ID bengkel tidak ditemukan")

        user_id = str(uuid.uuid4())
        user_document = {
            "id": user_id,
            "username": normalized_username,
            "full_name": payload.full_name.strip(),
            "password_hash": hash_password(payload.password),
            "created_at": created_at,
            "last_workshop_id": None,
        }
        if normalized_email:
            user_document["email"] = normalized_email

        membership_document = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "workshop_id": workshop["id"],
            "role": payload.requested_role or "kasir",
            "status": "pending",
            "created_at": created_at,
            "updated_at": created_at,
        }
        await db.users.insert_one({**user_document})
        await db.workshop_memberships.insert_one({**membership_document})
        return RegisterResponse(
            message="Pendaftaran berhasil dikirim. Tunggu persetujuan admin bengkel.",
            requires_approval=True,
        )

    workshop_name = (payload.workshop_name or "").strip()
    if not workshop_name:
        raise HTTPException(status_code=400, detail="Nama bengkel wajib diisi untuk pendaftaran pemilik")

    user_id = str(uuid.uuid4())
    user_document = {
        "id": user_id,
        "username": normalized_username,
        "full_name": payload.full_name.strip(),
        "password_hash": hash_password(payload.password),
        "created_at": created_at,
        "last_workshop_id": None,
    }
    if normalized_email:
        user_document["email"] = normalized_email

    workshop_id = str(uuid.uuid4())
    workshop_document = {
        "id": workshop_id,
        "workshop_code": await generate_unique_workshop_code(),
        "workshop_name": workshop_name,
        "owner_name": payload.full_name.strip(),
        "phone": "",
        "address": "",
        "open_hours": "",
        "notes": "",
        "customers": [],
        "manual_mechanics": [],
        "created_at": created_at,
        "updated_at": created_at,
    }
    membership_document = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "workshop_id": workshop_id,
        "role": "owner",
        "status": "active",
        "created_at": created_at,
        "updated_at": created_at,
    }

    await db.users.insert_one({**user_document})
    await db.workshops.insert_one({**workshop_document})
    await db.workshop_memberships.insert_one({**membership_document})
    await db.users.update_one({"id": user_id}, {"$set": {"last_workshop_id": workshop_id}})

    auth_response = await issue_auth_bundle(response, user_document, workshop_id)
    return RegisterResponse(
        message="Akun pemilik bengkel berhasil dibuat.",
        access_token=auth_response.access_token,
        token_type=auth_response.token_type,
        user=auth_response.user,
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    identifier = f"{request.client.host if request.client else 'unknown'}:{normalize_username(payload.username)}"
    await ensure_login_not_locked(identifier)

    user = await get_user_account_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        await record_failed_login(identifier)
        attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
        if attempt and int(attempt.get("failed_count", 0)) >= FAILED_LOGIN_THRESHOLD:
            raise HTTPException(
                status_code=429,
                detail=f"Terlalu banyak percobaan login. Coba lagi dalam {LOCKOUT_MINUTES} menit.",
            )
        raise HTTPException(status_code=401, detail="Username atau password salah")

    await clear_login_attempts(identifier)

    active_accesses = await get_workshop_accesses(user["id"], ["active"])
    if not active_accesses:
        pending_accesses = await get_workshop_accesses(user["id"], ["pending"])
        if pending_accesses:
            raise HTTPException(status_code=403, detail="Akun Anda masih menunggu persetujuan bengkel")
        raise HTTPException(status_code=403, detail="Akun Anda belum memiliki akses bengkel aktif")

    preferred_workshop_id = user.get("last_workshop_id")
    if preferred_workshop_id and not any(access.workshop_id == preferred_workshop_id for access in active_accesses):
        preferred_workshop_id = active_accesses[0].workshop_id

    return await issue_auth_bundle(response, user, preferred_workshop_id or active_accesses[0].workshop_id)


@api_router.get("/auth/me", response_model=UserSession)
async def read_me(current_user: dict = Depends(get_current_user)) -> UserSession:
    return await build_session_user(current_user, current_user["workshop_id"])


@api_router.post("/auth/switch-workshop", response_model=AuthResponse)
async def switch_workshop(
    payload: SwitchWorkshopRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
) -> AuthResponse:
    membership = await db.workshop_memberships.find_one(
        {"user_id": current_user["id"], "workshop_id": payload.workshop_id, "status": "active"},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses aktif ke bengkel tersebut")

    user_account = await get_user_account_by_id(current_user["id"])
    if not user_account:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return await issue_auth_bundle(response, user_account, payload.workshop_id)


@api_router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)) -> DashboardSummary:
    workshop_id = current_user["workshop_id"]
    total_inventory_items = await db.inventory.count_documents({"workshop_id": workshop_id})
    total_transactions = await db.transactions.count_documents({"workshop_id": workshop_id})
    low_stock_items_raw = await db.inventory.find(
        {
            "workshop_id": workshop_id,
            "$expr": {"$lte": ["$stock", "$low_stock_threshold"]},
        },
        {"_id": 0},
    ).sort("updated_at", 1).to_list(5)
    recent_transactions_raw = await db.transactions.find(
        {"workshop_id": workshop_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(5)
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    today_transactions = await db.transactions.find(
        {"workshop_id": workshop_id, "transaction_date": {"$regex": f"^{today_prefix}"}},
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


@api_router.get("/workshops", response_model=list[WorkshopAccess])
async def list_workshops(current_user: dict = Depends(get_current_user)) -> list[WorkshopAccess]:
    return await get_workshop_accesses(current_user["id"], ["active"])


@api_router.post("/workshops", response_model=AuthResponse)
async def create_workshop(
    payload: WorkshopCreateRequest,
    response: Response,
    owner_user: dict = Depends(get_owner_user),
) -> AuthResponse:
    timestamp = now_iso()
    workshop_id = str(uuid.uuid4())
    workshop_document = {
        "id": workshop_id,
        "workshop_code": await generate_unique_workshop_code(),
        "workshop_name": payload.workshop_name.strip(),
        "owner_name": (payload.owner_name or owner_user["full_name"]).strip(),
        "phone": payload.phone.strip(),
        "address": payload.address.strip(),
        "open_hours": payload.open_hours.strip(),
        "notes": payload.notes.strip(),
        "customers": [],
        "manual_mechanics": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    membership_document = {
        "id": str(uuid.uuid4()),
        "user_id": owner_user["id"],
        "workshop_id": workshop_id,
        "role": "owner",
        "status": "active",
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    await db.workshops.insert_one({**workshop_document})
    await db.workshop_memberships.insert_one({**membership_document})
    user_account = await get_user_account_by_id(owner_user["id"])
    if not user_account:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return await issue_auth_bundle(response, user_account, workshop_id)


@api_router.post("/auth/refresh", response_model=AuthResponse)
async def refresh_auth_token(request: Request, response: Response) -> AuthResponse:
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token tidak ditemukan")

    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Refresh token sudah berakhir") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Refresh token tidak valid") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Tipe refresh token tidak valid")

    user_account = await get_user_account_by_id(payload.get("sub", ""))
    if not user_account:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return await issue_auth_bundle(response, user_account, user_account.get("last_workshop_id"))


@api_router.post("/auth/logout", response_model=ApiMessage)
async def logout_user(response: Response) -> ApiMessage:
    clear_auth_cookies(response)
    return ApiMessage(message="Berhasil keluar")


@api_router.get("/workshop", response_model=WorkshopDetailResponse)
async def read_workshop(current_user: dict = Depends(get_current_user)) -> WorkshopDetailResponse:
    workshop = await db.workshops.find_one({"id": current_user["workshop_id"]}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=404, detail="Bengkel tidak ditemukan")

    workshop_payload = {
        **workshop,
        "customers": workshop.get("customers", []),
        "manual_mechanics": workshop.get("manual_mechanics", []),
    }

    members = await list_workshop_members(current_user["workshop_id"], "active")
    pending_members = await list_workshop_members(current_user["workshop_id"], "pending")
    accesses = await get_workshop_accesses(current_user["id"], ["active"])
    return WorkshopDetailResponse(
        **workshop_payload,
        mechanic_options=build_mechanic_options(workshop_payload, members),
        members=members,
        pending_members=pending_members,
        workshops=accesses,
    )


@api_router.put("/workshop", response_model=WorkshopDetailResponse)
async def update_workshop(
    payload: WorkshopUpdateRequest,
    manager_user: dict = Depends(get_manager_user),
) -> WorkshopDetailResponse:
    workshop_id = manager_user["workshop_id"]
    existing = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Bengkel tidak ditemukan")

    updated = {
        **existing,
        "workshop_name": payload.workshop_name.strip(),
        "owner_name": payload.owner_name.strip(),
        "phone": payload.phone.strip(),
        "address": payload.address.strip(),
        "open_hours": payload.open_hours.strip(),
        "notes": payload.notes.strip(),
        "updated_at": now_iso(),
    }
    updated["customers"] = existing.get("customers", [])
    updated["manual_mechanics"] = existing.get("manual_mechanics", [])
    await db.workshops.update_one({"id": workshop_id}, {"$set": updated})

    members = await list_workshop_members(workshop_id, "active")
    pending_members = await list_workshop_members(workshop_id, "pending")
    accesses = await get_workshop_accesses(manager_user["id"], ["active"])
    return WorkshopDetailResponse(
        **updated,
        mechanic_options=build_mechanic_options(updated, members),
        members=members,
        pending_members=pending_members,
        workshops=accesses,
    )


@api_router.patch("/workshop/members/{membership_id}", response_model=ApiMessage)
async def update_workshop_member(
    membership_id: str,
    payload: MembershipActionRequest,
    manager_user: dict = Depends(get_manager_user),
) -> ApiMessage:
    membership = await db.workshop_memberships.find_one(
        {"id": membership_id, "workshop_id": manager_user["workshop_id"]},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Anggota bengkel tidak ditemukan")

    if payload.action == "approve":
        await db.workshop_memberships.update_one(
            {"id": membership_id},
            {"$set": {"status": "active", "updated_at": now_iso()}},
        )
        return ApiMessage(message="Akses karyawan berhasil disetujui")

    if payload.action == "set-role":
        if membership["role"] == "owner":
            raise HTTPException(status_code=400, detail="Role owner tidak bisa diubah dari halaman ini")
        if not payload.role:
            raise HTTPException(status_code=400, detail="Role baru wajib dipilih")
        await db.workshop_memberships.update_one(
            {"id": membership_id},
            {"$set": {"role": payload.role, "updated_at": now_iso()}},
        )
        return ApiMessage(message="Role anggota berhasil diperbarui")

    if membership["user_id"] == manager_user["id"]:
        raise HTTPException(status_code=400, detail="Anda tidak bisa menghapus akses diri sendiri")

    if membership["role"] == "owner":
        owner_count = await db.workshop_memberships.count_documents(
            {"workshop_id": manager_user["workshop_id"], "role": "owner", "status": "active"}
        )
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Bengkel harus memiliki minimal satu owner aktif")

    await db.workshop_memberships.delete_one({"id": membership_id})
    return ApiMessage(message="Akses anggota berhasil dihapus")


@api_router.post("/workshop/customers", response_model=ApiMessage)
async def add_workshop_customer(
    payload: WorkshopNameCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> ApiMessage:
    customer_name = payload.name.strip()
    if not customer_name:
        raise HTTPException(status_code=400, detail="Nama pelanggan wajib diisi")

    workshop = await db.workshops.find_one({"id": current_user["workshop_id"]}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=404, detail="Bengkel tidak ditemukan")

    customers = workshop.get("customers", [])
    if customer_name not in customers:
        customers.append(customer_name)
        await db.workshops.update_one(
            {"id": current_user["workshop_id"]},
            {"$set": {"customers": customers, "updated_at": now_iso()}},
        )
    return ApiMessage(message="Pelanggan berhasil disimpan")


@api_router.post("/workshop/mechanics", response_model=MechanicAccountResponse)
async def add_workshop_mechanic(
    payload: WorkshopNameCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> MechanicAccountResponse:
    mechanic_name = payload.name.strip()
    if not mechanic_name:
        raise HTTPException(status_code=400, detail="Nama mekanik wajib diisi")

    mechanic_result = await ensure_mechanic_account(current_user["workshop_id"], mechanic_name)
    if not mechanic_result["created_account"]:
        return MechanicAccountResponse(
            message="Mekanik sudah tersedia",
            created_account=False,
            username=mechanic_result["username"],
        )

    return MechanicAccountResponse(
        message="Mekanik berhasil dibuat sebagai akun karyawan bengkel",
        created_account=True,
        username=mechanic_result["username"],
    )


@api_router.get("/users", response_model=list[WorkshopMember])
async def list_users(current_user: dict = Depends(get_current_user)) -> list[WorkshopMember]:
    return await list_workshop_members(current_user["workshop_id"], "active")


@api_router.patch("/users/{membership_id}/role", response_model=ApiMessage)
async def update_user_role(
    membership_id: str,
    payload: WorkshopMemberRoleRequest,
    manager_user: dict = Depends(get_manager_user),
) -> ApiMessage:
    membership = await db.workshop_memberships.find_one(
        {"id": membership_id, "workshop_id": manager_user["workshop_id"], "status": "active"},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Anggota aktif tidak ditemukan")
    if membership["role"] == "owner":
        raise HTTPException(status_code=400, detail="Role owner tidak bisa diubah")
    await db.workshop_memberships.update_one(
        {"id": membership_id},
        {"$set": {"role": payload.role, "updated_at": now_iso()}},
    )
    return ApiMessage(message="Role anggota berhasil diperbarui")


@api_router.delete("/users/{membership_id}", response_model=ApiMessage)
async def delete_user_access(
    membership_id: str,
    manager_user: dict = Depends(get_manager_user),
) -> ApiMessage:
    membership = await db.workshop_memberships.find_one(
        {"id": membership_id, "workshop_id": manager_user["workshop_id"]},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Akses anggota tidak ditemukan")
    if membership["user_id"] == manager_user["id"]:
        raise HTTPException(status_code=400, detail="Anda tidak bisa menghapus akses diri sendiri")
    if membership["role"] == "owner":
        owner_count = await db.workshop_memberships.count_documents(
            {"workshop_id": manager_user["workshop_id"], "role": "owner", "status": "active"}
        )
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Bengkel harus memiliki minimal satu owner aktif")
    await db.workshop_memberships.delete_one({"id": membership_id})
    return ApiMessage(message="Akses anggota berhasil dihapus")


@api_router.patch("/users/{membership_id}/password", response_model=UserPasswordUpdateResponse)
async def update_user_password(
    membership_id: str,
    payload: UserPasswordUpdateRequest,
    manager_user: dict = Depends(get_manager_user),
) -> UserPasswordUpdateResponse:
    membership = await db.workshop_memberships.find_one(
        {"id": membership_id, "workshop_id": manager_user["workshop_id"], "status": "active"},
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Anggota aktif tidak ditemukan")
    if membership["user_id"] == manager_user["id"]:
        raise HTTPException(status_code=400, detail="Ubah password diri sendiri dari akun yang dipakai")
    if membership["role"] == "owner":
        raise HTTPException(status_code=400, detail="Password owner tidak bisa diubah dari menu ini")
    if membership["role"] == "admin" and manager_user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Hanya owner yang dapat mengubah password admin")

    user = await db.users.find_one({"id": membership["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Akun pengguna tidak ditemukan")

    next_password = payload.password.strip() if payload.password else generate_temporary_password()
    await db.users.update_one(
        {"id": membership["user_id"]},
        {"$set": {"password_hash": hash_password(next_password)}},
    )

    return UserPasswordUpdateResponse(
        message="Password karyawan berhasil diperbarui",
        username=user["username"],
        temporary_password=None if payload.password else next_password,
    )


@api_router.get("/items", response_model=list[InventoryItem])
async def list_items(
    q: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
) -> list[InventoryItem]:
    filters: dict = {"workshop_id": current_user["workshop_id"]}
    if q.strip():
        filters["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"item_code": {"$regex": q, "$options": "i"}},
            {"notes": {"$regex": q, "$options": "i"}},
            {"unit": {"$regex": q, "$options": "i"}},
        ]
    items = await db.inventory.find(filters, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [InventoryItem(**normalize_inventory_item_document(item)) for item in items]


@api_router.post("/items", response_model=InventoryItem)
async def create_item(
    payload: InventoryItemCreate,
    manager_user: dict = Depends(get_manager_user),
) -> InventoryItem:
    item_code = payload.item_code.strip().upper()
    existing_item = await db.inventory.find_one(
        {"item_code": item_code, "workshop_id": manager_user["workshop_id"]},
        {"_id": 0},
    )
    if existing_item:
        raise HTTPException(status_code=400, detail="Kode barang sudah dipakai")

    timestamp = now_iso()
    item = InventoryItem(
        id=str(uuid.uuid4()),
        workshop_id=manager_user["workshop_id"],
        name=payload.name.strip(),
        stock=payload.stock,
        item_code=item_code,
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
    manager_user: dict = Depends(get_manager_user),
) -> InventoryItem:
    existing_item = await db.inventory.find_one(
        {"id": item_id, "workshop_id": manager_user["workshop_id"]},
        {"_id": 0},
    )
    if not existing_item:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")

    item_code = payload.item_code.strip().upper()
    duplicate_item = await db.inventory.find_one(
        {"item_code": item_code, "workshop_id": manager_user["workshop_id"], "id": {"$ne": item_id}},
        {"_id": 0},
    )
    if duplicate_item:
        raise HTTPException(status_code=400, detail="Kode barang sudah dipakai")

    updated_item = InventoryItem(
        id=item_id,
        workshop_id=manager_user["workshop_id"],
        name=payload.name.strip(),
        stock=payload.stock,
        item_code=item_code,
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
    await db.inventory.update_one(
        {"id": item_id, "workshop_id": manager_user["workshop_id"]},
        {"$set": updated_item.model_dump()},
    )
    return updated_item


@api_router.delete("/items/{item_id}", response_model=ApiMessage)
async def delete_item(
    item_id: str,
    manager_user: dict = Depends(get_manager_user),
) -> ApiMessage:
    existing_item = await db.inventory.find_one(
        {"id": item_id, "workshop_id": manager_user["workshop_id"]},
        {"_id": 0},
    )
    if not existing_item:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")

    transaction_usage = await db.transactions.count_documents(
        {"workshop_id": manager_user["workshop_id"], "lines": {"$elemMatch": {"item_id": item_id}}}
    )
    if transaction_usage > 0:
        raise HTTPException(status_code=400, detail="Barang sudah dipakai di transaksi dan tidak bisa dihapus")

    await db.inventory.delete_one({"id": item_id, "workshop_id": manager_user["workshop_id"]})
    return ApiMessage(message="Barang berhasil dihapus")


@api_router.get("/transactions", response_model=list[TransactionRecord])
async def list_transactions(
    start_date: str = Query(default=""),
    end_date: str = Query(default=""),
    status_filter: str = Query(default="", alias="status"),
    mechanic_name: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
) -> list[TransactionRecord]:
    filters: dict = {"workshop_id": current_user["workshop_id"]}
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
    transaction = await db.transactions.find_one(
        {"id": transaction_id, "workshop_id": current_user["workshop_id"]},
        {"_id": 0},
    )
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

    workshop_id = current_user["workshop_id"]
    if payload.customer_mode == "konsumen" and payload.mechanic_name.strip():
        await ensure_mechanic_account(workshop_id, payload.mechanic_name)
    transaction_lines, inventory_updates, subtotal = await build_transaction_lines_and_stock(workshop_id, payload.lines, payload.customer_mode)
    total = round(max(subtotal - payload.discount, 0), 2)
    timestamp = now_iso()
    payment_fields = derive_payment_fields(total, payload.amount_paid)

    transaction = TransactionRecord(
        id=str(uuid.uuid4()),
        workshop_id=workshop_id,
        invoice_number=(payload.invoice_number or generate_invoice_number()).strip(),
        transaction_date=timestamp,
        customer_mode=payload.customer_mode,
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
    await apply_inventory_stock_updates(workshop_id, inventory_updates, timestamp)
    return transaction


@api_router.put("/transactions/{transaction_id}", response_model=TransactionRecord)
async def update_transaction(
    transaction_id: str,
    payload: TransactionCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> TransactionRecord:
    if current_user["role"] == "mekanik":
        raise HTTPException(status_code=403, detail="Role mekanik tidak bisa mengubah transaksi")

    workshop_id = current_user["workshop_id"]
    if payload.customer_mode == "konsumen" and payload.mechanic_name.strip():
        await ensure_mechanic_account(workshop_id, payload.mechanic_name)
    existing_transaction = await db.transactions.find_one(
        {"id": transaction_id, "workshop_id": workshop_id},
        {"_id": 0},
    )
    if not existing_transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    transaction_lines, inventory_updates, subtotal = await build_transaction_lines_and_stock(
        workshop_id,
        payload.lines,
        payload.customer_mode,
        existing_transaction["lines"],
    )
    total = round(max(subtotal - payload.discount, 0), 2)
    payment_fields = derive_payment_fields(total, payload.amount_paid)
    updated_transaction = TransactionRecord(
        id=transaction_id,
        workshop_id=workshop_id,
        invoice_number=(payload.invoice_number or existing_transaction["invoice_number"]).strip(),
        transaction_date=existing_transaction["transaction_date"],
        customer_mode=payload.customer_mode,
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

    await db.transactions.update_one(
        {"id": transaction_id, "workshop_id": workshop_id},
        {"$set": updated_transaction.model_dump()},
    )
    await apply_inventory_stock_updates(workshop_id, inventory_updates, now_iso())
    return updated_transaction


@api_router.delete("/transactions/{transaction_id}", response_model=ApiMessage)
async def delete_transaction(
    transaction_id: str,
    manager_user: dict = Depends(get_manager_user),
) -> ApiMessage:
    workshop_id = manager_user["workshop_id"]
    existing_transaction = await db.transactions.find_one(
        {"id": transaction_id, "workshop_id": workshop_id},
        {"_id": 0},
    )
    if not existing_transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    timestamp = now_iso()
    await restore_inventory_stock(existing_transaction["lines"], workshop_id, timestamp)
    await db.transactions.delete_one({"id": transaction_id, "workshop_id": workshop_id})
    return ApiMessage(message="Transaksi berhasil dihapus")


@api_router.get("/backups/export")
async def export_backup_data(manager_user: dict = Depends(get_manager_user)) -> dict:
    workshop_id = manager_user["workshop_id"]
    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    memberships = await db.workshop_memberships.find(
        {"workshop_id": workshop_id},
        {"_id": 0},
    ).to_list(200)
    user_ids = [membership["user_id"] for membership in memberships]
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", 1).to_list(200)
    inventory_items = await db.inventory.find({"workshop_id": workshop_id}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    transactions = await db.transactions.find({"workshop_id": workshop_id}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    normalized_transactions = [normalize_transaction_document(transaction) for transaction in transactions]

    return {
        "exported_at": now_iso(),
        "workshop": workshop,
        "users": users,
        "memberships": memberships,
        "inventory_items": inventory_items,
        "transactions": normalized_transactions,
        "counts": {
            "users": len(users),
            "inventory_items": len(inventory_items),
            "transactions": len(normalized_transactions),
        },
    }


app.include_router(api_router)

allowed_origins = [
    origin
    for origin in [
        os.environ.get("FRONTEND_URL"),
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
    ]
    if origin
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
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