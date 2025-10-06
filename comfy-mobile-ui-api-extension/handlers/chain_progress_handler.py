"""
Chain Progress WebSocket Handler

Provides WebSocket endpoint for real-time chain execution progress updates.
"""

from aiohttp import web
import asyncio

# Import progress manager
try:
    from ..utils.chain_progress_manager import chain_progress_manager
except ImportError:
    from utils.chain_progress_manager import chain_progress_manager


async def chain_progress_websocket(request):
    """
    WebSocket endpoint for chain execution progress
    WS /comfymobile/api/chains/progress
    """
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    print("[ChainProgressWS] Client connected")

    # Add client and send initial state
    await chain_progress_manager.add_client(ws)

    try:
        # Keep connection alive and handle incoming messages
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                # Client can send ping messages to keep connection alive
                if msg.data == 'ping':
                    await ws.send_str('pong')
                # Client requests current state
                elif msg.data == 'request_state':
                    print("[ChainProgressWS] Client requested current state")
                    await chain_progress_manager.send_current_state(ws)
            elif msg.type == web.WSMsgType.ERROR:
                print(f"[ChainProgressWS] WebSocket error: {ws.exception()}")
                break
    except Exception as e:
        print(f"[ChainProgressWS] Exception: {e}")
    finally:
        # Remove client on disconnect
        await chain_progress_manager.remove_client(ws)
        print("[ChainProgressWS] Client disconnected")

    return ws
