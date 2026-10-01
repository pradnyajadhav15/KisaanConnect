"""
Brute-force protection for login: too many failed attempts get a 429 for a while.

Two counters, each over a sliding 15-minute window:
  - per username (5 failures): stops password guessing on one account
  - per client IP (20 failures): stops one machine trying many accounts

Kept in memory, so it resets when the server restarts and isn't shared between
server processes. That's fine for a single Render instance; with several
instances, move the counters to Redis.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

WINDOW_SECONDS = 15 * 60
MAX_FAILURES_PER_USERNAME = 5
MAX_FAILURES_PER_IP = 20

_lock = threading.Lock()
_failures: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    """The caller's IP. Behind Render's proxy the real one is the first X-Forwarded-For entry."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _keys(request: Request, username: str) -> list[tuple[str, int]]:
    return [
        (f"user:{username.strip().lower()}", MAX_FAILURES_PER_USERNAME),
        (f"ip:{client_ip(request)}", MAX_FAILURES_PER_IP),
    ]


def check(request: Request, username: str) -> None:
    """Raise 429 if this username or IP has failed too often recently."""
    now = time.monotonic()
    with _lock:
        for key, limit in _keys(request, username):
            attempts = _failures.get(key)
            if not attempts:
                continue
            while attempts and now - attempts[0] > WINDOW_SECONDS:
                attempts.popleft()
            if not attempts:
                del _failures[key]
            elif len(attempts) >= limit:
                retry_after = int(WINDOW_SECONDS - (now - attempts[0])) + 1
                minutes = max(1, round(retry_after / 60))
                raise HTTPException(
                    429,
                    f"Too many failed login attempts. Please try again in {minutes} minute(s).",
                    headers={"Retry-After": str(retry_after)},
                )


def record_failure(request: Request, username: str) -> None:
    now = time.monotonic()
    with _lock:
        for key, _ in _keys(request, username):
            _failures[key].append(now)


def record_success(request: Request, username: str) -> None:
    """A correct password clears that account's counter (the IP counter stays)."""
    with _lock:
        _failures.pop(f"user:{username.strip().lower()}", None)


def reset() -> None:
    with _lock:
        _failures.clear()
