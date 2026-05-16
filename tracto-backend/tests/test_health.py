"""Smoke tests — endpoint de health e estrutura básica."""


def test_health_check(unauth_client):
    """GET / não requer auth e retorna status online."""
    r = unauth_client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "Tracto backend online"
    assert "version" in body
    assert "timestamp" in body


def test_security_headers_present(unauth_client):
    """Confirma que middleware de segurança injeta headers críticos."""
    r = unauth_client.get("/")
    headers = {k.lower(): v for k, v in r.headers.items()}
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert "strict-transport-security" in headers
    assert "content-security-policy" in headers


def test_request_id_returned(unauth_client):
    """X-Request-ID é injetado e único por request."""
    r1 = unauth_client.get("/")
    r2 = unauth_client.get("/")
    assert r1.headers.get("x-request-id")
    assert r2.headers.get("x-request-id")
    assert r1.headers["x-request-id"] != r2.headers["x-request-id"]
