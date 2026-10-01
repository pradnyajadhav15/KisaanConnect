"""
Request IDs, request logging, security headers and optional Sentry error reporting.

Every response carries an X-Request-ID header, and every request is logged as
    request_id=3f9a1c2b7e10 POST /consumer/orders 200 84ms
so a user's error report can be matched to the exact log line on Render.
Unexpected errors are logged with their full traceback and returned as a short JSON
message with the same request_id. If SENTRY_DSN is set, they also go to Sentry.
"""
import logging
import os
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("kisaanconnect")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",          # don't guess content types
    "X-Frame-Options": "DENY",                    # the API is never shown in a frame
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",  # HTTPS only (ignored on http://localhost)
}

_sentry_enabled = False


def init_sentry() -> bool:
    """Turn on Sentry if SENTRY_DSN is set. Never sends request bodies or user details."""
    global _sentry_enabled
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        send_default_pii=False,
        traces_sample_rate=0.0,
    )
    _sentry_enabled = True
    return True


def setup(app: FastAPI) -> None:
    """Add before CORSMiddleware, so CORS headers also reach error responses."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    if init_sentry():
        log.info("Sentry error reporting is on")

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = (request.headers.get("x-request-id") or uuid.uuid4().hex[:12])[:64]
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("request_id=%s %s %s crashed", request_id, request.method, request.url.path)
            if _sentry_enabled:
                import sentry_sdk

                sentry_sdk.capture_exception()
            response = JSONResponse(
                {"detail": "Something went wrong. Please try again.", "request_id": request_id},
                status_code=500,
            )
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.info("request_id=%s %s %s %s %.0fms", request_id, request.method,
                 request.url.path, response.status_code, elapsed_ms)
        response.headers["X-Request-ID"] = request_id
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response
