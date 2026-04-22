import os

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
    # Auth module: login cashier for role access checks
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


class TestDashboardAndBackup:
    # Dashboard + backup module: summary payload and admin-only export verification

    def test_dashboard_summary_contains_requested_focus_sections(self, api_client, admin_headers):
        response = api_client.get(f"{BASE_URL}/api/dashboard/summary", headers=admin_headers, timeout=20)
        assert response.status_code == 200
        payload = response.json()

        assert isinstance(payload.get("total_transactions"), int)
        assert isinstance(payload.get("today_revenue"), (int, float))
        assert isinstance(payload.get("low_stock_items"), list)
        assert isinstance(payload.get("recent_transactions"), list)

    def test_backup_export_admin_success_and_contains_counts(self, api_client, admin_headers):
        response = api_client.get(f"{BASE_URL}/api/backups/export", headers=admin_headers, timeout=30)
        assert response.status_code == 200
        payload = response.json()

        assert isinstance(payload.get("users"), list)
        assert isinstance(payload.get("inventory_items"), list)
        assert isinstance(payload.get("transactions"), list)
        assert payload.get("counts", {}).get("users") == len(payload.get("users", []))

    def test_backup_export_forbidden_for_non_admin(self, api_client, kasir_headers):
        response = api_client.get(f"{BASE_URL}/api/backups/export", headers=kasir_headers, timeout=20)
        assert response.status_code == 403
