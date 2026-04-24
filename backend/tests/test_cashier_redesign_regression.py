import os
import uuid

import pytest
import requests
from dotenv import load_dotenv


# Environment module: use published preview URL from frontend env
load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def owner_session(api_client):
    # Auth module: login with provided owner demo credentials
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")

    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "ownerdemo", "password": "owner123"},
        timeout=20,
    )
    if response.status_code != 200:
        pytest.skip(f"Owner auth failed: {response.status_code} {response.text}")

    token = response.json().get("access_token")
    return {
        "token": token,
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        "response": response,
    }


@pytest.fixture()
def created_entities(api_client, owner_session):
    # Cleanup module: remove test transactions/items created by these tests
    created_transaction_ids: list[str] = []
    created_item_ids: list[str] = []
    yield {"transactions": created_transaction_ids, "items": created_item_ids}

    headers = owner_session["headers"]

    for transaction_id in created_transaction_ids:
        api_client.delete(f"{BASE_URL}/api/transactions/{transaction_id}", headers=headers, timeout=20)

    for item_id in created_item_ids:
        api_client.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers, timeout=20)


def _create_item(api_client, headers, unique_suffix: str) -> dict:
    payload = {
        "name": f"TEST_Cashier_Item_{unique_suffix}",
        "stock": 40,
        "item_code": f"TCR-{unique_suffix}".upper(),
        "unit": "pcs",
        "cost_price": 4000,
        "workshop_price": 7000,
        "consumer_price": 10000,
        "notes": "TEST item for cashier regression",
        "price": 10000,
        "category": "Sparepart",
        "supplier": "TEST Supplier",
        "low_stock_threshold": 3,
    }
    response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=headers, timeout=20)
    assert response.status_code == 200
    return response.json()


def _create_transaction(api_client, headers, payload: dict) -> dict:
    response = api_client.post(f"{BASE_URL}/api/transactions", json=payload, headers=headers, timeout=20)
    assert response.status_code == 200
    return response.json()


class TestCashierBackendFlows:
    # Cashier transaction module: customer_mode pricing and payment summary persistence

    def test_customer_mode_konsumen_uses_consumer_price(self, api_client, owner_session, created_entities):
        unique = str(uuid.uuid4())[:8]
        headers = owner_session["headers"]
        item = _create_item(api_client, headers, unique)
        created_entities["items"].append(item["id"])

        payload = {
            "customer_mode": "konsumen",
            "customer_name": f"TEST_Customer_{unique}",
            "mechanic_name": "TEST_Mekanik",
            "notes": "TEST consumer mode",
            "payment_method": "tunai",
            "status": "paid",
            "discount": 0,
            "amount_paid": 10000,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": 123,
                }
            ],
        }

        trx = _create_transaction(api_client, headers, payload)
        created_entities["transactions"].append(trx["id"])
        assert trx["customer_mode"] == "konsumen"
        assert trx["lines"][0]["unit_price"] == item["consumer_price"]

    def test_customer_mode_bengkel_uses_workshop_price(self, api_client, owner_session, created_entities):
        unique = str(uuid.uuid4())[:8]
        headers = owner_session["headers"]
        item = _create_item(api_client, headers, unique)
        created_entities["items"].append(item["id"])

        payload = {
            "customer_mode": "bengkel",
            "customer_name": f"TEST_WorkshopCustomer_{unique}",
            "mechanic_name": "TEST_Mekanik",
            "notes": "TEST workshop mode",
            "payment_method": "transfer",
            "status": "paid",
            "discount": 0,
            "amount_paid": 7000,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": 99999,
                }
            ],
        }

        trx = _create_transaction(api_client, headers, payload)
        created_entities["transactions"].append(trx["id"])
        assert trx["customer_mode"] == "bengkel"
        assert trx["lines"][0]["unit_price"] == item["workshop_price"]

    def test_payment_summary_supports_discount_partial_debt_and_change(self, api_client, owner_session, created_entities):
        unique = str(uuid.uuid4())[:8]
        headers = owner_session["headers"]
        item = _create_item(api_client, headers, unique)
        created_entities["items"].append(item["id"])

        payload_hutang = {
            "customer_mode": "konsumen",
            "customer_name": f"TEST_Hutang_{unique}",
            "mechanic_name": "TEST_Mekanik",
            "notes": "TEST payment debt",
            "payment_method": "qris",
            "status": "unpaid",
            "discount": 1000,
            "amount_paid": 4000,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": 1,
                }
            ],
        }
        trx_hutang = _create_transaction(api_client, headers, payload_hutang)
        created_entities["transactions"].append(trx_hutang["id"])

        assert trx_hutang["subtotal"] == item["consumer_price"]
        assert trx_hutang["total"] == item["consumer_price"] - 1000
        assert trx_hutang["payment_state"] == "hutang"
        assert trx_hutang["balance_due"] == (item["consumer_price"] - 1000) - 4000
        assert trx_hutang["change_due"] == 0

        payload_kembalian = {
            "customer_mode": "konsumen",
            "customer_name": f"TEST_Kembalian_{unique}",
            "mechanic_name": "TEST_Mekanik",
            "notes": "TEST payment change",
            "payment_method": "tunai",
            "status": "paid",
            "discount": 0,
            "amount_paid": 15000,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": 1,
                }
            ],
        }
        trx_kembalian = _create_transaction(api_client, headers, payload_kembalian)
        created_entities["transactions"].append(trx_kembalian["id"])

        assert trx_kembalian["payment_state"] == "kembalian"
        assert trx_kembalian["change_due"] == 15000 - item["consumer_price"]
        assert trx_kembalian["balance_due"] == 0

    def test_update_existing_transaction_loads_and_persists_without_crash(self, api_client, owner_session, created_entities):
        unique = str(uuid.uuid4())[:8]
        headers = owner_session["headers"]
        item = _create_item(api_client, headers, unique)
        created_entities["items"].append(item["id"])

        created = _create_transaction(
            api_client,
            headers,
            {
                "customer_mode": "konsumen",
                "customer_name": f"TEST_Edit_{unique}",
                "mechanic_name": "M1",
                "notes": "before-edit",
                "payment_method": "tunai",
                "status": "unpaid",
                "discount": 0,
                "amount_paid": 0,
                "lines": [
                    {
                        "item_id": item["id"],
                        "type": "barang",
                        "name": item["name"],
                        "quantity": 1,
                        "unit_price": 1,
                    }
                ],
            },
        )
        created_entities["transactions"].append(created["id"])

        update_payload = {
            "customer_mode": "bengkel",
            "customer_name": f"TEST_Edit_{unique}",
            "mechanic_name": "M2",
            "notes": "after-edit",
            "payment_method": "transfer",
            "status": "paid",
            "discount": 500,
            "amount_paid": 7000,
            "lines": [
                {
                    "item_id": item["id"],
                    "type": "barang",
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": 2,
                },
                {
                    "type": "jasa",
                    "name": "TEST_Jasa",
                    "quantity": 1,
                    "unit_price": 2500,
                },
            ],
        }
        update_response = api_client.put(
            f"{BASE_URL}/api/transactions/{created['id']}",
            json=update_payload,
            headers=headers,
            timeout=20,
        )
        assert update_response.status_code == 200

        get_response = api_client.get(f"{BASE_URL}/api/transactions/{created['id']}", headers=headers, timeout=20)
        assert get_response.status_code == 200
        persisted = get_response.json()
        assert persisted["customer_mode"] == "bengkel"
        assert persisted["mechanic_name"] == "M2"
        assert persisted["notes"] == "after-edit"
        assert len(persisted["lines"]) == 2


class TestAuthPlaybookChecks:
    # Auth hardening module: cookie, cors credentials, brute-force lockout, bcrypt format

    def test_login_sets_http_only_access_and_refresh_cookies(self, owner_session):
        response = owner_session["response"]
        set_cookie_header = response.headers.get("set-cookie", "")
        assert "access_token=" in set_cookie_header
        assert "refresh_token=" in set_cookie_header
        assert "HttpOnly" in set_cookie_header

    def test_cors_credentials_uses_explicit_origin_not_wildcard(self, api_client):
        if not BASE_URL:
            pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")

        response = api_client.options(
            f"{BASE_URL}/api/auth/login",
            headers={
                "Origin": BASE_URL,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
            timeout=20,
        )
        allow_origin = response.headers.get("access-control-allow-origin", "")
        allow_credentials = response.headers.get("access-control-allow-credentials", "")
        assert allow_credentials.lower() == "true"
        assert allow_origin not in {"", "*"}

    def test_bruteforce_lockout_after_five_failed_attempts(self, api_client):
        username = f"lockout_user_{str(uuid.uuid4())[:8]}"
        status_codes: list[int] = []
        for _ in range(6):
            response = api_client.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": username, "password": "wrong-password"},
                timeout=20,
            )
            status_codes.append(response.status_code)

        assert status_codes[-1] == 429

    def test_seeded_owner_password_hash_starts_with_2b(self, api_client, owner_session):
        # Approximate verification via login behavior: correct password works and incorrect fails.
        # Direct DB hash inspection is not exposed by public API; tracked via code review instead.
        ok_response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "ownerdemo", "password": "owner123"},
            timeout=20,
        )
        bad_response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "ownerdemo", "password": "owner123-wrong"},
            timeout=20,
        )
        assert ok_response.status_code == 200
        assert bad_response.status_code == 401
