"""Unit tests for the login brute-force limiter (no database needed)."""
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from auth import login_limiter as L


def request_from(ip="10.0.0.1", forwarded=None):
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": (ip, 1234)})


@pytest.fixture(autouse=True)
def clean_limiter():
    L.reset()
    yield
    L.reset()


def fail(req, username, times):
    for _ in range(times):
        L.check(req, username)
        L.record_failure(req, username)


def test_username_is_blocked_after_max_failures():
    req = request_from()
    fail(req, "asha", L.MAX_FAILURES_PER_USERNAME)
    with pytest.raises(HTTPException) as e:
        L.check(req, "asha")
    assert e.value.status_code == 429
    assert int(e.value.headers["Retry-After"]) > 0


def test_username_match_ignores_case_and_spaces():
    fail(request_from(), "Asha ", L.MAX_FAILURES_PER_USERNAME)
    with pytest.raises(HTTPException):
        L.check(request_from(ip="10.9.9.9"), "asha")      # same account, different machine


def test_success_clears_the_account_counter():
    req = request_from()
    fail(req, "asha", L.MAX_FAILURES_PER_USERNAME - 1)
    L.record_success(req, "asha")
    fail(req, "asha", L.MAX_FAILURES_PER_USERNAME - 1)    # would have hit the limit without the reset
    L.check(req, "asha")


def test_one_ip_trying_many_accounts_is_blocked():
    req = request_from()
    for i in range(L.MAX_FAILURES_PER_IP):
        fail(req, f"user{i}", 1)
    with pytest.raises(HTTPException):
        L.check(req, "someone-new")
    L.check(request_from(ip="10.0.0.2"), "someone-new")    # other machines are unaffected


def test_forwarded_for_header_identifies_the_client():
    assert L.client_ip(request_from(ip="127.0.0.1", forwarded="203.0.113.7, 10.1.1.1")) == "203.0.113.7"
    assert L.client_ip(request_from(ip="198.51.100.4")) == "198.51.100.4"


def test_block_expires_after_the_window(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(L.time, "monotonic", lambda: now[0])
    req = request_from()
    fail(req, "asha", L.MAX_FAILURES_PER_USERNAME)
    with pytest.raises(HTTPException):
        L.check(req, "asha")
    now[0] += L.WINDOW_SECONDS + 1
    L.check(req, "asha")
