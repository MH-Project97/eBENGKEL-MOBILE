import os
import uuid

import pytest
import requests
from dotenv import load_dotenv


# Environment module: prefer EXPO_BACKEND_URL, fallback to existing preview key for compatibility.
load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")

OWNER_USERNAME = "ownerdemo"
OWNER_PASSWORD = "owner123"


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def base_url():
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL is not configured")
    return BASE_URL


# Auth module: login helpers and bearer header generation.
def login(api_client: requests.Session, base_url: str, username: str, password: str) -> dict:
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"username": username, "password": password},
        timeout=25,
    )
    return {"status_code": response.status_code, "data": response.json() if response.content else {}}


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# Health module: basic API readiness.
def test_health_ok(api_client, base_url):
    response = api_client.get(f"{base_url}/api/health", timeout=20)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


# Owner auth module: verify multi-workshop session structure on login.
def test_owner_login_contains_workshop_and_role(api_client, base_url):
    result = login(api_client, base_url, OWNER_USERNAME, OWNER_PASSWORD)
    if result["status_code"] != 200:
        pytest.skip(f"Owner login failed: {result['status_code']} {result['data']}")

    user = result["data"]["user"]
    assert user["role"] == "owner"
    assert len(user["workshop_code"]) == 18
    assert isinstance(user["workshops"], list) and len(user["workshops"]) >= 1


# Employee registration module: reject invalid 18-char workshop ID.
def test_employee_register_rejects_invalid_workshop_code_length(api_client, base_url):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "account_type": "employee",
        "username": f"test_badcode_{unique}",
        "full_name": "TEST Invalid Code",
        "password": "testpass123",
        "workshop_code": "SHORT123",
        "requested_role": "kasir",
    }
    response = api_client.post(f"{base_url}/api/auth/register", json=payload, timeout=25)
    assert response.status_code == 400
    assert "18 karakter" in response.json().get("detail", "")


# Approval workflow module: pending employee cannot login until owner approves.
def test_employee_pending_then_owner_approves_access(api_client, base_url):
    owner_result = login(api_client, base_url, OWNER_USERNAME, OWNER_PASSWORD)
    if owner_result["status_code"] != 200:
        pytest.skip(f"Owner login failed: {owner_result['status_code']} {owner_result['data']}")

    owner_token = owner_result["data"]["access_token"]
    owner_user = owner_result["data"]["user"]
    active_workshop_code = owner_user["workshop_code"]

    unique = uuid.uuid4().hex[:10]
    employee_username = f"test_emp_{unique}"
    employee_password = "staff12345"
    register_payload = {
        "account_type": "employee",
        "username": employee_username,
        "full_name": "TEST Pending Employee",
        "password": employee_password,
        "email": f"{employee_username}@example.com",
        "workshop_code": active_workshop_code,
        "requested_role": "kasir",
    }
    register_response = api_client.post(f"{base_url}/api/auth/register", json=register_payload, timeout=25)
    assert register_response.status_code == 200
    register_data = register_response.json()
    assert register_data["requires_approval"] is True

    pending_login = login(api_client, base_url, employee_username, employee_password)
    assert pending_login["status_code"] == 403
    assert "menunggu persetujuan" in pending_login["data"].get("detail", "")

    workshop_response = api_client.get(
        f"{base_url}/api/workshop",
        headers=auth_headers(owner_token),
        timeout=25,
    )
    assert workshop_response.status_code == 200
    pending_members = workshop_response.json().get("pending_members", [])
    matched_member = next((m for m in pending_members if m["username"] == employee_username), None)
    assert matched_member is not None

    approve_response = api_client.patch(
        f"{base_url}/api/workshop/members/{matched_member['membership_id']}",
        headers=auth_headers(owner_token),
        json={"action": "approve"},
        timeout=25,
    )
    assert approve_response.status_code == 200

    approved_login = login(api_client, base_url, employee_username, employee_password)
    assert approved_login["status_code"] == 200
    assert approved_login["data"]["user"]["workshop_code"] == active_workshop_code


# Workshop management module: owner can create and switch active workshop.
def test_owner_create_and_switch_workshop(api_client, base_url):
    owner_result = login(api_client, base_url, OWNER_USERNAME, OWNER_PASSWORD)
    if owner_result["status_code"] != 200:
        pytest.skip(f"Owner login failed: {owner_result['status_code']} {owner_result['data']}")

    owner_token = owner_result["data"]["access_token"]
    original_workshop_id = owner_result["data"]["user"]["workshop_id"]
    original_count = len(owner_result["data"]["user"]["workshops"])

    create_payload = {
        "workshop_name": f"TEST Bengkel {uuid.uuid4().hex[:6]}",
        "owner_name": owner_result["data"]["user"]["full_name"],
        "phone": "",
        "address": "",
        "open_hours": "",
        "notes": "",
    }
    create_response = api_client.post(
        f"{base_url}/api/workshops",
        headers=auth_headers(owner_token),
        json=create_payload,
        timeout=25,
    )
    assert create_response.status_code == 200
    created_data = create_response.json()
    assert len(created_data["user"]["workshops"]) == original_count + 1
    new_workshop_id = created_data["user"]["workshop_id"]
    assert new_workshop_id != original_workshop_id

    switch_back = api_client.post(
        f"{base_url}/api/auth/switch-workshop",
        headers=auth_headers(created_data["access_token"]),
        json={"workshop_id": original_workshop_id},
        timeout=25,
    )
    assert switch_back.status_code == 200
    assert switch_back.json()["user"]["workshop_id"] == original_workshop_id


# Inventory module: verify data is isolated per workshop.
def test_inventory_isolated_between_owner_workshops(api_client, base_url):
    owner_result = login(api_client, base_url, OWNER_USERNAME, OWNER_PASSWORD)
    if owner_result["status_code"] != 200:
        pytest.skip(f"Owner login failed: {owner_result['status_code']} {owner_result['data']}")

    token_a = owner_result["data"]["access_token"]
    user_a = owner_result["data"]["user"]
    workshop_a_id = user_a["workshop_id"]
    workshops = user_a["workshops"]

    other_workshop = next((w for w in workshops if w["workshop_id"] != workshop_a_id), None)
    if not other_workshop:
        create_response = api_client.post(
            f"{base_url}/api/workshops",
            headers=auth_headers(token_a),
            json={
                "workshop_name": f"TEST Isolasi {uuid.uuid4().hex[:6]}",
                "owner_name": user_a["full_name"],
                "phone": "",
                "address": "",
                "open_hours": "",
                "notes": "",
            },
            timeout=25,
        )
        assert create_response.status_code == 200
        token_a = create_response.json()["access_token"]
        new_user = create_response.json()["user"]
        other_workshop = next((w for w in new_user["workshops"] if w["workshop_id"] != new_user["workshop_id"]), None)
        workshop_a_id = new_user["workshop_id"]

    assert other_workshop is not None

    unique_a = uuid.uuid4().hex[:8].upper()
    item_a_payload = {
        "name": f"TEST A {unique_a}",
        "stock": 3,
        "item_code": f"TA-{unique_a}",
        "unit": "pcs",
        "cost_price": 1000,
        "workshop_price": 2000,
        "consumer_price": 2500,
        "notes": "",
        "category": "TEST",
        "supplier": "TEST",
        "low_stock_threshold": 1,
    }
    create_item_a = api_client.post(
        f"{base_url}/api/items",
        headers=auth_headers(token_a),
        json=item_a_payload,
        timeout=25,
    )
    assert create_item_a.status_code == 200
    item_a = create_item_a.json()

    switch_to_b = api_client.post(
        f"{base_url}/api/auth/switch-workshop",
        headers=auth_headers(token_a),
        json={"workshop_id": other_workshop["workshop_id"]},
        timeout=25,
    )
    assert switch_to_b.status_code == 200
    token_b = switch_to_b.json()["access_token"]

    list_in_b = api_client.get(
        f"{base_url}/api/items?q={item_a_payload['item_code']}",
        headers=auth_headers(token_b),
        timeout=25,
    )
    assert list_in_b.status_code == 200
    assert all(row["item_code"] != item_a_payload["item_code"] for row in list_in_b.json())

    unique_b = uuid.uuid4().hex[:8].upper()
    item_b_payload = {
        "name": f"TEST B {unique_b}",
        "stock": 4,
        "item_code": f"TB-{unique_b}",
        "unit": "pcs",
        "cost_price": 1200,
        "workshop_price": 2200,
        "consumer_price": 2600,
        "notes": "",
        "category": "TEST",
        "supplier": "TEST",
        "low_stock_threshold": 1,
    }
    create_item_b = api_client.post(
        f"{base_url}/api/items",
        headers=auth_headers(token_b),
        json=item_b_payload,
        timeout=25,
    )
    assert create_item_b.status_code == 200
    item_b = create_item_b.json()

    switch_to_a = api_client.post(
        f"{base_url}/api/auth/switch-workshop",
        headers=auth_headers(token_b),
        json={"workshop_id": workshop_a_id},
        timeout=25,
    )
    assert switch_to_a.status_code == 200
    token_a2 = switch_to_a.json()["access_token"]

    list_in_a = api_client.get(
        f"{base_url}/api/items?q={item_b_payload['item_code']}",
        headers=auth_headers(token_a2),
        timeout=25,
    )
    assert list_in_a.status_code == 200
    assert all(row["item_code"] != item_b_payload["item_code"] for row in list_in_a.json())

    # Cleanup created items in each workshop context.
    delete_a = api_client.delete(f"{base_url}/api/items/{item_a['id']}", headers=auth_headers(token_a2), timeout=25)
    assert delete_a.status_code == 200

    switch_back_b = api_client.post(
        f"{base_url}/api/auth/switch-workshop",
        headers=auth_headers(token_a2),
        json={"workshop_id": other_workshop["workshop_id"]},
        timeout=25,
    )
    assert switch_back_b.status_code == 200
    token_b2 = switch_back_b.json()["access_token"]
    delete_b = api_client.delete(f"{base_url}/api/items/{item_b['id']}", headers=auth_headers(token_b2), timeout=25)
    assert delete_b.status_code == 200
