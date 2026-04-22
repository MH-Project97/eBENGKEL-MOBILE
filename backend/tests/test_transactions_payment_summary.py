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
def admin_headers(api_client):
    # Auth module: login as admin for transaction + inventory flows
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured")

    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    if response.status_code != 200:
        pytest.skip(f"Admin auth failed: {response.status_code} {response.text}")

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _create_item(api_client, headers, unique: str) -> dict:
    payload = {
        "name": f"TEST_Payment_Item_{unique}",
        "category": "Sparepart",
        "price": 10000,
        "stock": 100,
        "supplier": "TEST Supplier",
        "item_code": f"PAY-{unique}".upper(),
        "low_stock_threshold": 2,
    }
    response = api_client.post(f"{BASE_URL}/api/items", json=payload, headers=headers, timeout=20)
    assert response.status_code == 200
    return response.json()


def _create_transaction(api_client, headers, *, customer: str, item_id: str, item_name: str, amount_paid: float) -> dict:
    # Transactions module: create transaction with amount_paid and verify computed status fields
    payload = {
        "customer_name": customer,
        "mechanic_name": "TEST_Mekanik_Payment",
        "notes": "TEST payment state",
        "payment_method": "tunai",
        "status": "paid",
        "discount": 0,
        "amount_paid": amount_paid,
        "lines": [
            {
                "item_id": item_id,
                "type": "barang",
                "name": item_name,
                "quantity": 1,
                "unit_price": 10000,
            }
        ],
    }
    response = api_client.post(f"{BASE_URL}/api/transactions", json=payload, headers=headers, timeout=20)
    assert response.status_code == 200
    return response.json()


class TestTransactionsPaymentStates:
    # Payment module: hutang/lunas/kembalian from create + persistence via GET

    def test_create_transaction_hutang_state(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = _create_item(api_client, admin_headers, unique)
        trx = _create_transaction(
            api_client,
            admin_headers,
            customer=f"TEST_Pelanggan_{unique}",
            item_id=item["id"],
            item_name=item["name"],
            amount_paid=6000,
        )

        assert trx["payment_state"] == "hutang"
        assert trx["status"] == "unpaid"
        assert trx["balance_due"] == 4000
        assert trx["change_due"] == 0

        get_resp = api_client.get(f"{BASE_URL}/api/transactions/{trx['id']}", headers=admin_headers, timeout=20)
        assert get_resp.status_code == 200
        persisted = get_resp.json()
        assert persisted["payment_state"] == "hutang"
        assert persisted["balance_due"] == 4000

    def test_create_transaction_lunas_state(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = _create_item(api_client, admin_headers, unique)
        trx = _create_transaction(
            api_client,
            admin_headers,
            customer=f"TEST_Pelanggan_{unique}",
            item_id=item["id"],
            item_name=item["name"],
            amount_paid=10000,
        )

        assert trx["payment_state"] == "lunas"
        assert trx["status"] == "paid"
        assert trx["balance_due"] == 0
        assert trx["change_due"] == 0

    def test_create_transaction_kembalian_state(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = _create_item(api_client, admin_headers, unique)
        trx = _create_transaction(
            api_client,
            admin_headers,
            customer=f"TEST_Pelanggan_{unique}",
            item_id=item["id"],
            item_name=item["name"],
            amount_paid=15000,
        )

        assert trx["payment_state"] == "kembalian"
        assert trx["status"] == "paid"
        assert trx["balance_due"] == 0
        assert trx["change_due"] == 5000


class TestTransactionsEditAndFilters:
    # Transactions module: update amount_paid and ensure filter still works with transaction list

    def test_update_transaction_amount_paid_recomputes_fields(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = _create_item(api_client, admin_headers, unique)
        customer_name = f"TEST_EditPay_{unique}"
        created = _create_transaction(
            api_client,
            admin_headers,
            customer=customer_name,
            item_id=item["id"],
            item_name=item["name"],
            amount_paid=4000,
        )
        assert created["payment_state"] == "hutang"

        update_payload = {
            "customer_name": customer_name,
            "mechanic_name": "TEST_Mekanik_Payment",
            "notes": "TEST payment update",
            "payment_method": "tunai",
            "status": "paid",
            "discount": 0,
            "amount_paid": 12000,
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
        update_resp = api_client.put(
            f"{BASE_URL}/api/transactions/{created['id']}",
            json=update_payload,
            headers=admin_headers,
            timeout=20,
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["payment_state"] == "kembalian"
        assert updated["change_due"] == 2000
        assert updated["balance_due"] == 0

        get_resp = api_client.get(f"{BASE_URL}/api/transactions/{created['id']}", headers=admin_headers, timeout=20)
        assert get_resp.status_code == 200
        persisted = get_resp.json()
        assert persisted["payment_state"] == "kembalian"
        assert persisted["change_due"] == 2000

    def test_list_transactions_filters_and_customer_records_include_payment_fields(self, api_client, admin_headers):
        unique = str(uuid.uuid4())[:8]
        item = _create_item(api_client, admin_headers, unique)
        customer_name = f"TEST_Summary_{unique}"

        _create_transaction(
            api_client,
            admin_headers,
            customer=customer_name,
            item_id=item["id"],
            item_name=item["name"],
            amount_paid=5000,
        )
        _create_transaction(
            api_client,
            admin_headers,
            customer=customer_name,
            item_id=item["id"],
            item_name=item["name"],
            amount_paid=10000,
        )

        list_resp = api_client.get(
            f"{BASE_URL}/api/transactions?status=unpaid&mechanic_name=TEST_Mekanik_Payment",
            headers=admin_headers,
            timeout=20,
        )
        assert list_resp.status_code == 200
        rows = list_resp.json()
        assert any(row["customer_name"] == customer_name for row in rows)

        matching = [row for row in rows if row["customer_name"] == customer_name]
        assert len(matching) >= 1
        for row in matching:
            assert "amount_paid" in row
            assert "balance_due" in row
            assert "change_due" in row
            assert row["status"] == "unpaid"
