import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv


# Load frontend env because preview URL is published there in this environment
load_dotenv("/app/frontend/.env")


BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
)


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def base_url():
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")
    return BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def admin_auth(api_client, base_url):
    """Auth module: login admin demo and provide bearer token"""
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "admin"
    return {
        "Authorization": f"Bearer {data['access_token']}",
        "Content-Type": "application/json",
    }


class TestAuthAndDashboard:
    """Authentication + dashboard summary module"""

    def test_login_admin_success(self, api_client, base_url):
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"username": "admin", "password": "admin123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["username"] == "admin"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20

    def test_register_user_success(self, api_client, base_url):
        unique = str(uuid.uuid4())[:8]
        username = f"test_reg_{unique}"
        payload = {
            "username": username,
            "full_name": "TEST Register User",
            "password": "testpass123",
            "email": f"{username}@example.com",
        }
        register_response = api_client.post(f"{base_url}/api/auth/register", json=payload)
        assert register_response.status_code == 200
        register_data = register_response.json()
        assert register_data["user"]["username"] == username
        assert register_data["user"]["role"] == "kasir"

        me_response = api_client.get(
            f"{base_url}/api/auth/me",
            headers={
                "Authorization": f"Bearer {register_data['access_token']}",
                "Content-Type": "application/json",
            },
        )
        assert me_response.status_code == 200
        assert me_response.json()["username"] == username

    def test_dashboard_summary_visible_after_login(self, api_client, base_url, admin_auth):
        response = api_client.get(f"{base_url}/api/dashboard/summary", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["total_inventory_items"], int)
        assert isinstance(data["recent_transactions"], list)


class TestInventoryCashierTransactions:
    """Inventory + cashier transaction module"""

    def test_create_item_and_verify_persistence(self, api_client, base_url, admin_auth):
        unique = str(uuid.uuid4())[:8]
        item_code = f"TEST-{unique}".upper()
        payload = {
            "name": f"TEST Oli {unique}",
            "category": "Pelumas",
            "price": 75000,
            "stock": 15,
            "supplier": "TEST Supplier",
            "item_code": item_code,
            "low_stock_threshold": 5,
        }
        create_response = api_client.post(f"{base_url}/api/items", json=payload, headers=admin_auth)
        assert create_response.status_code == 200
        created_item = create_response.json()
        assert created_item["item_code"] == item_code

        list_response = api_client.get(f"{base_url}/api/items?q={item_code}", headers=admin_auth)
        assert list_response.status_code == 200
        listed_items = list_response.json()
        assert any(item["id"] == created_item["id"] for item in listed_items)

    def test_create_cashier_transaction_with_item_service_discount_payment(self, api_client, base_url, admin_auth):
        unique = str(uuid.uuid4())[:8]
        item_code = f"TESTTRX-{unique}".upper()
        item_payload = {
            "name": f"TEST Busi {unique}",
            "category": "Sparepart",
            "price": 50000,
            "stock": 20,
            "supplier": "TEST Supplier",
            "item_code": item_code,
            "low_stock_threshold": 5,
        }
        item_create = api_client.post(f"{base_url}/api/items", json=item_payload, headers=admin_auth)
        assert item_create.status_code == 200
        item = item_create.json()

        trx_payload = {
            "customer_name": "TEST Customer",
            "mechanic_name": "TEST Mechanic",
            "notes": "TEST transaksi kombinasi barang jasa",
            "payment_method": "qris",
            "status": "paid",
            "discount": 10000,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 2,
                    "unit_price": item["price"],
                },
                {
                    "type": "jasa",
                    "name": "Jasa pasang",
                    "quantity": 1,
                    "unit_price": 30000,
                },
            ],
        }
        create_trx = api_client.post(f"{base_url}/api/transactions", json=trx_payload, headers=admin_auth)
        assert create_trx.status_code == 200
        trx = create_trx.json()
        assert trx["payment_method"] == "qris"
        assert trx["discount"] == 10000
        assert len(trx["lines"]) == 2

        # GET verify transaction persisted
        history = api_client.get(f"{base_url}/api/transactions", headers=admin_auth)
        assert history.status_code == 200
        all_trx = history.json()
        assert any(t["id"] == trx["id"] for t in all_trx)

        # GET verify inventory reduced
        items_resp = api_client.get(f"{base_url}/api/items?q={item_code}", headers=admin_auth)
        assert items_resp.status_code == 200
        matching = [x for x in items_resp.json() if x["id"] == item["id"]]
        assert len(matching) == 1
        assert matching[0]["stock"] == 18


class TestWorkshopAndUsers:
    """Workshop profile + users management module"""

    def test_update_workshop_and_verify(self, api_client, base_url, admin_auth):
        unique = str(uuid.uuid4())[:6]
        payload = {
            "workshop_name": f"TEST Bengkel {unique}",
            "owner_name": "TEST Owner",
            "phone": "081234567890",
            "address": "Jl. TEST No. 123",
            "open_hours": "08:00-17:00",
            "notes": "TEST update workshop",
        }
        put_resp = api_client.put(f"{base_url}/api/workshop", json=payload, headers=admin_auth)
        assert put_resp.status_code == 200
        put_data = put_resp.json()
        assert put_data["workshop_name"] == payload["workshop_name"]

        get_resp = api_client.get(f"{base_url}/api/workshop", headers=admin_auth)
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data["workshop_name"] == payload["workshop_name"]

    def test_admin_can_add_user_and_update_role(self, api_client, base_url, admin_auth):
        unique = str(uuid.uuid4())[:8]
        username = f"test_user_{unique}"
        create_payload = {
            "username": username,
            "full_name": "TEST Added User",
            "password": "testpass123",
            "email": f"{username}@example.com",
            "role": "kasir",
        }

        create_resp = api_client.post(f"{base_url}/api/users", json=create_payload, headers=admin_auth)
        assert create_resp.status_code == 200
        created_user = create_resp.json()
        assert created_user["username"] == username
        assert created_user["role"] == "kasir"

        role_resp = api_client.patch(
            f"{base_url}/api/users/{created_user['id']}/role",
            json={"role": "mekanik"},
            headers=admin_auth,
        )
        assert role_resp.status_code == 200
        assert role_resp.json()["role"] == "mekanik"

        users_resp = api_client.get(f"{base_url}/api/users", headers=admin_auth)
        assert users_resp.status_code == 200
        users = users_resp.json()
        found = next((u for u in users if u["id"] == created_user["id"]), None)
        assert found is not None and found["role"] == "mekanik"


def test_health_endpoint(api_client, base_url):
    """Health endpoint module"""
    response = api_client.get(f"{base_url}/api/health")
    if response.status_code != 200:
        time.sleep(1)
        response = api_client.get(f"{base_url}/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"