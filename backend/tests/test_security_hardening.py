"""
T11 — Security-Specific Adversarial Tests

Probes Sentinel's own security posture, not just its detection accuracy.
Documents known gaps (e.g., no rate limiting, unauthenticated GET endpoints)
honestly so they can be reported as known limitations.
"""

import pytest
import uuid
import time
from concurrent.futures import ThreadPoolExecutor
from models import App


# ---------------------------------------------------------------------------
# 1. SQL injection attempt in the app_id field of /analyze
# ---------------------------------------------------------------------------
class TestSQLInjection:

    @pytest.mark.parametrize("malicious_app_id", [
        pytest.param("1\' OR \'1\'=\'1", id="classic-or-1-equals-1"),
        pytest.param("\'; DROP TABLE apps; --", id="drop-table"),
        pytest.param("1 UNION SELECT * FROM apps", id="union-select"),
        pytest.param("admin\'--", id="admin-comment"),
    ])
    def test_sql_injection_in_app_id(self, client, test_app, malicious_app_id):
        """
        SQLAlchemy uses parameterized queries, so the injection payload is treated
        as a literal string for app_id lookup. It simply won't match any row, and
        the endpoint returns 401 ("Invalid App ID or API Key"). This is the
        correct, secure behavior — no 500, no stack trace, no SQL leakage.
        """
        payload = {"app_id": malicious_app_id, "message": "benign message"}
        headers = {"Authorization": f"Bearer {test_app.api_key}"}

        res = client.post("/analyze", json=payload, headers=headers)

        # 401 is the expected secure outcome: parameterized query finds no match
        assert res.status_code == 401, (
            f"Expected 401 for SQL injection payload '{malicious_app_id}', "
            f"got {res.status_code}"
        )
        # Verify no internal details are leaked
        body = res.text.lower()
        assert "sqlite3" not in body
        assert "operationalerror" not in body
        assert "sql syntax" not in body
        assert "traceback" not in body


# ---------------------------------------------------------------------------
# 2. Extremely large payload
# ---------------------------------------------------------------------------
class TestLargePayload:

    def test_large_message_body(self, client, test_app):
        """
        Send a 100KB message body. FastAPI/Starlette doesn't enforce a body size
        limit by default, so this will likely be accepted. We document this gap
        and recommend adding a body size limit middleware.

        NOTE: Using 100KB to keep the test fast (spaCy NER is slow on large text).
        The real concern (10MB payload) is documented as a gap.
        """
        large_message = "A" * (100 * 1024)  # 100KB
        payload = {"app_id": str(test_app.id), "message": large_message}
        headers = {"Authorization": f"Bearer {test_app.api_key}"}

        res = client.post("/analyze", json=payload, headers=headers)

        # We accept either outcome:
        # - 413 if a body size limit is configured (ideal)
        # - 200 if no limit is configured (current behavior — documented gap)
        assert res.status_code in [200, 413], f"Unexpected status: {res.status_code}"
        if res.status_code == 200:
            print(
                "\n[SECURITY GAP] Large payloads (100KB+) are currently accepted. "
                "Recommend adding request body size limit middleware (e.g., reject >1MB)."
            )


# ---------------------------------------------------------------------------
# 3. Rapid-fire requests from the same app_id (50 requests in 1 second)
# ---------------------------------------------------------------------------
class TestRapidFire:

    def test_rapid_fire_no_rate_limiting(self, client, test_app):
        """
        Send 10 concurrent requests as fast as possible. No rate limiting
        is expected per the PRD — this test documents that gap.
        
        NOTE: Using 10 (not 50) to keep the test fast since each request
        runs through spaCy NER. The principle is the same.
        """
        payload = {"app_id": str(test_app.id), "message": "benign rapid request"}
        headers = {"Authorization": f"Bearer {test_app.api_key}"}

        start = time.time()

        # Use a thread pool to fire requests concurrently
        def fire_request(_):
            return client.post("/analyze", json=payload, headers=headers)

        with ThreadPoolExecutor(max_workers=5) as executor:
            responses = list(executor.map(fire_request, range(10)))

        elapsed = time.time() - start
        status_codes = [r.status_code for r in responses]

        # All should succeed (200) since there is no rate limiting
        success_count = status_codes.count(200)
        assert success_count == 10, (
            f"Expected all 10 to return 200, but {10 - success_count} failed"
        )
        print(
            f"\n[SECURITY GAP] No rate limiting active. "
            f"10 concurrent requests completed in {elapsed:.2f}s, all returned 200."
        )


# ---------------------------------------------------------------------------
# 4. Cross-tenant access via /incidents and /stats (adversarial angle)
# ---------------------------------------------------------------------------
class TestCrossTenantAccess:

    def test_incidents_cross_tenant_no_auth_on_get(self, client, test_app, db_session):
        """
        /incidents and /stats are currently unauthenticated GET endpoints.
        Anyone who knows an app_id can read another app's incidents.
        This is a documented security gap.
        """
        # Create a second app
        other_app = App(
            id=str(uuid.uuid4()),
            name="Other App",
            api_key="other_key_456",
            threshold=40,
        )
        db_session.add(other_app)
        db_session.commit()

        # Try to read test_app's incidents using NO auth header at all
        res = client.get(f"/incidents?app_id={test_app.id}")
        assert res.status_code == 200, (
            "Expected 200 — /incidents is currently unauthenticated"
        )
        print(
            "\n[SECURITY GAP] /incidents and /stats endpoints are unauthenticated. "
            "Cross-tenant reads are possible if app_id is known."
        )

    def test_stats_cross_tenant_no_auth_on_get(self, client, test_app, db_session):
        """Same gap applies to /stats."""
        res = client.get(f"/stats?app_id={test_app.id}")
        assert res.status_code == 200
        print(
            "\n[SECURITY GAP] /stats endpoint is unauthenticated."
        )


# ---------------------------------------------------------------------------
# 5. Verify error responses never leak internal details
# ---------------------------------------------------------------------------
class TestErrorDetailLeakage:

    def test_malformed_json_body(self, client):
        """Send non-JSON body to /analyze — should return 422, no internals."""
        headers = {"Authorization": "Bearer some-key", "Content-Type": "application/json"}
        res = client.post("/analyze", content=b"this is not json", headers=headers)

        assert res.status_code == 422
        body = res.text
        assert "Traceback" not in body
        assert "File " not in body
        assert "sqlalchemy" not in body.lower()
        assert "sqlite" not in body.lower()

    def test_missing_content_type(self, client):
        """Send a request with no content type — should not crash."""
        headers = {"Authorization": "Bearer some-key"}
        res = client.post("/analyze", content=b"", headers=headers)

        assert res.status_code in [400, 415, 422]
        body = res.text
        assert "Traceback" not in body

    def test_nonexistent_endpoint(self, client):
        """Requesting a route that doesn't exist should return 404, not 500."""
        res = client.get("/admin/secret")
        assert res.status_code in [404, 405]
        body = res.text
        assert "Traceback" not in body
        assert "sqlalchemy" not in body.lower()
