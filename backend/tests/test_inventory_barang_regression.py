import os
import uuid

import pytest
import requests
from dotenv import load_dotenv


# Environment module: use published preview URL for API verification
load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_headers(api_client):
    # Auth module: login admin and return bearer token header
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    if response.status_code != 200:
        pytest.skip(f"Admin auth failed: {response.status_code} {response.text}")
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def kasir_headers(api_client):
    # Auth module: login cashier to verify role restrictions on item actions
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "kasir", "password": "kasir123"},
        timeout=20,
    )
    if response.status_code != 200:
        pytest.skip(f"Kasir auth failed: {response.status_code} {response.text}")
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture()
def created_item_ids():
    # Inventory module: keep track of created test items for cleanup
    return []


@pytest.fixture(autouse=True)
def cleanup_created_items(api_client, admin_headers, created_item_ids):
    yield
    for item_id in created_item_ids:
        api_client.delete(f"{BASE_URL}/api/items/{item_id}", headers=admin_headers, timeout=20)


def create_item_payload(unique: str) -> dict:
    return {
        "item_code": f"TEST-BRG-{unique}".upper(),
        "name": f"TEST Barang {unique}",
        "stock": 12,
        "unit": "pcs",
        "cost_price": 50000,
        "workshop_price": 65000,
        "consumer_price": 70000,
        "notes": f"TEST catatan {unique}",
        "category": "",
        "supplier": "",
        "low_stock_threshold": 4,
    }


class TestInventoryBarangFields:
    # Inventory module: create/read/update/search using requested Barang fields

    def test_create_item_with_new_fields_and_verify_persistence(self, api_client, admin_headers, created_item_ids):
        unique = str(uuid.uuid4())[:8]
        payload = create_item_payload(unique)

        create_response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=admin_headers, timeout=20)
        assert create_response.status_code == 200
        created = create_response.json()
        created_item_ids.append(created["id"])

        assert created["item_code"] == payload["item_code"]
        assert created["name"] == payload["name"]
        assert created["stock"] == payload["stock"]
        assert created["unit"] == payload["unit"]
        assert float(created["cost_price"]) == float(payload["cost_price"])
        assert float(created["workshop_price"]) == float(payload["workshop_price"])
        assert float(created["consumer_price"]) == float(payload["consumer_price"])
        assert created["notes"] == payload["notes"]

        get_response = api_client.get(f"{BASE_URL}/api/items?q={payload['item_code']}", headers=admin_headers, timeout=20)
        assert get_response.status_code == 200
        matches = [row for row in get_response.json() if row["id"] == created["id"]]
        assert len(matches) == 1
        assert matches[0]["item_code"] == payload["item_code"]

    def test_update_item_with_new_fields_and_verify_persistence(self, api_client, admin_headers, created_item_ids):
        unique = str(uuid.uuid4())[:8]
        payload = create_item_payload(unique)
        create_response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=admin_headers, timeout=20)
        assert create_response.status_code == 200
        created = create_response.json()
        created_item_ids.append(created["id"])

        updated_payload = {
            **payload,
            "name": f"TEST Barang Updated {unique}",
            "stock": 25,
            "unit": "set",
            "cost_price": 80000,
            "workshop_price": 90000,
            "consumer_price": 95000,
            "notes": f"TEST updated notes {unique}",
            "low_stock_threshold": 3,
        }

        update_response = api_client.put(
            f"{BASE_URL}/api/items/{created['id']}",
            json=updated_payload,
            headers=admin_headers,
            timeout=20,
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["name"] == updated_payload["name"]
        assert updated["stock"] == updated_payload["stock"]
        assert updated["unit"] == updated_payload["unit"]
        assert float(updated["consumer_price"]) == float(updated_payload["consumer_price"])

        get_response = api_client.get(f"{BASE_URL}/api/items?q={payload['item_code']}", headers=admin_headers, timeout=20)
        assert get_response.status_code == 200
        matches = [row for row in get_response.json() if row["id"] == created["id"]]
        assert len(matches) == 1
        assert matches[0]["notes"] == updated_payload["notes"]

    def test_search_returns_item_by_notes_and_code(self, api_client, admin_headers, created_item_ids):
        unique = str(uuid.uuid4())[:8]
        payload = create_item_payload(unique)
        create_response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=admin_headers, timeout=20)
        assert create_response.status_code == 200
        created = create_response.json()
        created_item_ids.append(created["id"])

        search_code = api_client.get(f"{BASE_URL}/api/items?q={payload['item_code']}", headers=admin_headers, timeout=20)
        assert search_code.status_code == 200
        assert any(row["id"] == created["id"] for row in search_code.json())

        search_notes = api_client.get(f"{BASE_URL}/api/items?q={unique}", headers=admin_headers, timeout=20)
        assert search_notes.status_code == 200
        assert any(row["id"] == created["id"] for row in search_notes.json())

    def test_non_admin_cannot_update_item(self, api_client, admin_headers, kasir_headers, created_item_ids):
        unique = str(uuid.uuid4())[:8]
        payload = create_item_payload(unique)
        create_response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=admin_headers, timeout=20)
        assert create_response.status_code == 200
        created = create_response.json()
        created_item_ids.append(created["id"])

        update_payload = {**payload, "name": f"TEST NonAdmin Update {unique}"}
        update_response = api_client.put(
            f"{BASE_URL}/api/items/{created['id']}",
            json=update_payload,
            headers=kasir_headers,
            timeout=20,
        )

        assert update_response.status_code == 403
