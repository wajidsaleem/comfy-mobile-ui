"""
Manager Proxy Handler
Provides proxy endpoints for ComfyUI Manager APIs to bypass CORS issues.
"""

from typing import Iterable
from aiohttp import web
import aiohttp

PROXY_HEADER_WHITELIST: Iterable[str] = (
    "content-type",
    "cache-control",
    "pragma",
    "expires",
)

async def _proxy_request(request: web.Request, method: str, target_path: str) -> web.StreamResponse:
    origin = request.url.origin()
    target_url = origin.with_path(target_path)
    if method == "GET":
        target_url = target_url.with_query(request.rel_url.query)

    data = None
    headers = {}
    if method in {"POST", "PUT", "PATCH"}:
        try:
            if request.can_read_body:
                data = await request.read()
            else:
                data = b""
        except Exception:
            data = b""
        content_type = request.headers.get("Content-Type")
        if content_type:
            headers["Content-Type"] = content_type

    async with aiohttp.ClientSession() as session:
        http_method = getattr(session, method.lower())
        async with http_method(str(target_url), data=data, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            resp_body = await resp.read()
            proxy_headers = {
                name: value
                for name, value in resp.headers.items()
                if name.lower() in PROXY_HEADER_WHITELIST
            }
            return web.Response(body=resp_body, status=resp.status, headers=proxy_headers)

async def manager_queue_start(request: web.Request) -> web.StreamResponse:
    return await _proxy_request(request, "GET", "/api/manager/queue/start")

async def manager_queue_install(request: web.Request) -> web.StreamResponse:
    return await _proxy_request(request, "POST", "/api/manager/queue/install")
