import os
import uuid

import pytest
import requests
from dotenv import load_dotenv


# Environment module: use public preview backend URL for regression checks
load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_headers(api_client):
    # Auth module: admin login for inventory compatibility testing
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


@pytest.fixture()
def created_item_ids():
    # Inventory module: cleanup tracker for temporary compatibility test data
    return []


@pytest.fixture(autouse=True)
def cleanup_created_items(api_client, admin_headers, created_item_ids):
    yield
    for item_id in created_item_ids:
        api_client.delete(f"{BASE_URL}/api/items/{item_id}", headers=admin_headers, timeout=20)


class TestInventorySortPaginationCompatibility:
    # Inventory module: verify list payload fields used by frontend sort/pagination/badges

    def test_items_list_has_required_fields_for_inventory_table(self, api_client, admin_headers):
        response = api_client.get(f"{BASE_URL}/api/items", headers=admin_headers, timeout=20)
        assert response.status_code == 200

        rows = response.json()
        assert isinstance(rows, list)
        if not rows:
            pytest.skip("No inventory rows available to validate schema compatibility")

        sample = rows[0]
        assert "item_code" in sample
        assert "stock" in sample
        assert "consumer_price" in sample
        assert "low_stock_threshold" in sample
        assert "_id" not in sample

    def test_create_item_with_sort_badge_fields_and_verify_persistence(self, api_client, admin_headers, created_item_ids):
        unique = str(uuid.uuid4())[:8]
        payload = {
            "item_code": f"TEST-SORT-{unique}".upper(),
            "name": f"TEST Sort Item {unique}",
            "stock": 2,
            "unit": "pcs",
            "cost_price": 15000,
            "workshop_price": 17000,
            "consumer_price": 19000,
            "notes": "TEST compatibility",
            "category": "",
            "supplier": "",
            "low_stock_threshold": 3,
        }

        create_response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=admin_headers, timeout=20)
        assert create_response.status_code == 200
        created = create_response.json()
        created_item_ids.append(created["id"])

        assert created["item_code"] == payload["item_code"]
        assert created["stock"] == payload["stock"]
        assert float(created["consumer_price"]) == float(payload["consumer_price"])
        assert created["low_stock_threshold"] == payload["low_stock_threshold"]

        get_response = api_client.get(
            f"{BASE_URL}/api/items?q={payload['item_code']}",
            headers=admin_headers,
            timeout=20,
        )
        assert get_response.status_code == 200
        matches = [row for row in get_response.json() if row["id"] == created["id"]]
        assert len(matches) == 1
        assert matches[0]["item_code"] == payload["item_code"]
