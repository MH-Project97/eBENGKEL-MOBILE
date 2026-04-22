import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv


# Environment module: use published preview base URL for API verification
load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def login(api_client: requests.Session, username: str, password: str) -> dict:
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    if response.status_code != 200:
        pytest.skip(f"Auth failed for {username}: {response.status_code} {response.text}")
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_headers(api_client):
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")
    return login(api_client, "admin", "admin123")


@pytest.fixture(scope="session")
def kasir_headers(api_client):
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")
    return login(api_client, "kasir", "kasir123")


def create_item(api_client, headers, unique: str, stock: int = 10) -> dict:
    payload = {
        "name": f"TEST_Item_{unique}",
        "category": "Sparepart",
        "price": 10000,
        "stock": stock,
        "supplier": "TEST Supplier",
        "item_code": f"TEST-{unique}".upper(),
        "low_stock_threshold": 2,
    }
    response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=headers, timeout=20)
    assert response.status_code == 200
    return response.json()


def read_item(api_client, headers, item_id: str) -> dict:
    response = api_client.get(f"{BASE_URL}/api/items", headers=headers, timeout=20)
    assert response.status_code == 200
    matches = [row for row in response.json() if row["id"] == item_id]
    assert len(matches) == 1
    return matches[0]


def create_transaction(api_client, headers, item_id: str, item_name: str, quantity: int, status: str, mechanic_name: str) -> dict:
    unit_price = 10000
    subtotal = unit_price * quantity
    amount_paid = subtotal if status == "paid" else 0
    payload = {
        "customer_name": "TEST Customer",
        "mechanic_name": mechanic_name,
        "notes": "TEST transaksi",
        "payment_method": "tunai",
        "status": status,
        "amount_paid": amount_paid,
        "discount": 0,
        "lines": [
            {
                "item_id": item_id,
                "type": "barang",
                "name": item_name,
                "quantity": quantity,
                "unit_price": unit_price,
            }
        ],
    }
    response = api_client.post(f"{BASE_URL}/api/transactions", json=payload, headers=headers, timeout=20)
    assert response.status_code == 200
    return response.json()


class TestTransactionsFiltersAndStock:
    # Transactions module: date/status/mechanic filters and stock reconciliation on edit/delete

    def test_filter_transactions_by_manual_date_status_and_mechanic(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = create_item(api_client, admin_headers, unique, stock=25)

        trx_paid = create_transaction(api_client, admin_headers, item["id"], item["name"], 1, "paid", f"TEST_Mekanik_A_{unique}")
        _trx_unpaid = create_transaction(api_client, admin_headers, item["id"], item["name"], 1, "unpaid", f"TEST_Mekanik_B_{unique}")

        today = datetime.now(timezone.utc).date().isoformat()
        response = api_client.get(
            f"{BASE_URL}/api/transactions?start_date={today}&end_date={today}&status=paid&mechanic_name=TEST_Mekanik_A_{unique}",
            headers=admin_headers,
            timeout=20,
        )
        assert response.status_code == 200
        rows = response.json()
        assert any(row["id"] == trx_paid["id"] for row in rows)
        assert all(row["status"] == "paid" for row in rows)
        assert all(f"test_mekanik_a_{unique}" in row["mechanic_name"].lower() for row in rows)

    def test_transaction_update_reconciles_inventory_stock(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = create_item(api_client, admin_headers, unique, stock=10)
        trx = create_transaction(api_client, admin_headers, item["id"], item["name"], 3, "paid", f"TEST_Mekanik_{unique}")

        stock_after_create = read_item(api_client, admin_headers, item["id"])["stock"]
        assert stock_after_create == 7

        update_payload = {
            "customer_name": "TEST Customer Updated",
            "mechanic_name": f"TEST_Mekanik_{unique}",
            "notes": "TEST transaksi update",
            "payment_method": "tunai",
            "status": "paid",
            "discount": 0,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": 10000,
                }
            ],
        }
        update_response = api_client.put(
            f"{BASE_URL}/api/transactions/{trx['id']}",
            json=update_payload,
            headers=admin_headers,
            timeout=20,
        )
        assert update_response.status_code == 200

        stock_after_update = read_item(api_client, admin_headers, item["id"])["stock"]
        assert stock_after_update == 9

    def test_transaction_delete_requires_admin_and_restores_stock(self, api_client, admin_headers, kasir_headers):
        unique = str(uuid.uuid4())[:8]
        item = create_item(api_client, admin_headers, unique, stock=12)
        trx = create_transaction(api_client, admin_headers, item["id"], item["name"], 4, "paid", f"TEST_Mekanik_{unique}")

        stock_after_create = read_item(api_client, admin_headers, item["id"])["stock"]
        assert stock_after_create == 8

        forbidden_delete = api_client.delete(
            f"{BASE_URL}/api/transactions/{trx['id']}",
            headers=kasir_headers,
            timeout=20,
        )
        assert forbidden_delete.status_code == 403

        admin_delete = api_client.delete(
            f"{BASE_URL}/api/transactions/{trx['id']}",
            headers=admin_headers,
            timeout=20,
        )
        assert admin_delete.status_code == 200

        stock_after_delete = read_item(api_client, admin_headers, item["id"])["stock"]
        assert stock_after_delete == 12


class TestInventoryAndUsersAdminDelete:
    # Inventory + users module: edit flows and admin-only delete verification

    def test_item_edit_and_admin_only_delete(self, api_client, admin_headers, kasir_headers):
        unique = str(uuid.uuid4())[:8]
        item = create_item(api_client, admin_headers, unique, stock=5)

        update_payload = {
            "name": f"TEST_Item_Updated_{unique}",
            "category": "Updated",
            "price": 15000,
            "stock": 9,
            "supplier": "TEST Supplier Updated",
            "item_code": f"TEST-{unique}".upper(),
            "low_stock_threshold": 3,
        }
        update_response = api_client.put(
            f"{BASE_URL}/api/items/{item['id']}",
            json=update_payload,
            headers=admin_headers,
            timeout=20,
        )
        assert update_response.status_code == 200
        assert update_response.json()["stock"] == 9

        forbidden_delete = api_client.delete(
            f"{BASE_URL}/api/items/{item['id']}",
            headers=kasir_headers,
            timeout=20,
        )
        assert forbidden_delete.status_code == 403

        admin_delete = api_client.delete(
            f"{BASE_URL}/api/items/{item['id']}",
            headers=admin_headers,
            timeout=20,
        )
        assert admin_delete.status_code == 200

    def test_user_edit_and_admin_only_delete(self, api_client, admin_headers, kasir_headers):
        unique = str(uuid.uuid4())[:8]
        create_payload = {
            "username": f"test_user_{unique}",
            "full_name": "TEST User",
            "password": "testpass123",
            "email": f"test_user_{unique}@example.com",
            "role": "kasir",
        }
        create_response = api_client.post(f"{BASE_URL}/api/users", json=create_payload, headers=admin_headers, timeout=20)
        assert create_response.status_code == 200
        user = create_response.json()

        update_payload = {
            "username": user["username"],
            "full_name": "TEST User Updated",
            "email": f"updated_{unique}@example.com",
            "role": "mekanik",
        }
        update_response = api_client.put(
            f"{BASE_URL}/api/users/{user['id']}",
            json=update_payload,
            headers=admin_headers,
            timeout=20,
        )
        assert update_response.status_code == 200
        assert update_response.json()["role"] == "mekanik"

        forbidden_delete = api_client.delete(
            f"{BASE_URL}/api/users/{user['id']}",
            headers=kasir_headers,
            timeout=20,
        )
        assert forbidden_delete.status_code == 403

        admin_delete = api_client.delete(
            f"{BASE_URL}/api/users/{user['id']}",
            headers=admin_headers,
            timeout=20,
        )
        assert admin_delete.status_code == 200
