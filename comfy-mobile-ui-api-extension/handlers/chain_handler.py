"""
Workflow Chain Handler

Handles CRUD operations for workflow chains:
- List all chains
- Get chain content
- Save/Update chain
- Delete chain
- Execute chain (future implementation)
"""

from aiohttp import web
from typing import Dict, Any
import json

# Import storage utilities
try:
    from ..utils.chain_storage import (
        save_chain,
        load_chain,
        delete_chain,
        list_chains,
        get_chain_summary,
        save_chain_thumbnail,
        get_chain_thumbnail,
        delete_chain_thumbnails
    )
except ImportError:
    from utils.chain_storage import (
        save_chain,
        load_chain,
        delete_chain,
        list_chains,
        get_chain_summary,
        save_chain_thumbnail,
        get_chain_thumbnail,
        delete_chain_thumbnails
    )

async def list_workflow_chains(request):
    """
    List all workflow chains
    GET /comfymobile/api/chains/list
    """
    try:
        result = list_chains()

        if result['success']:
            return web.json_response({
                "success": True,
                "chains": result['chains'],
                "count": result['count']
            })
        else:
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=500)

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to list chains: {str(e)}"
        }, status=500)

async def get_chain_content(request):
    """
    Get workflow chain content by ID
    GET /comfymobile/api/chains/content/{chain_id}
    """
    try:
        chain_id = request.match_info.get('chain_id')

        if not chain_id:
            return web.json_response({
                "success": False,
                "error": "Missing chain_id parameter"
            }, status=400)

        result = load_chain(chain_id)

        if result['success']:
            return web.json_response({
                "success": True,
                "chain": result['chain']
            })
        else:
            status_code = 404 if "not found" in result.get('error', '').lower() else 500
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=status_code)

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to get chain: {str(e)}"
        }, status=500)

async def save_workflow_chain(request):
    """
    Save or update a workflow chain
    POST /comfymobile/api/chains/save

    Expected JSON body:
    {
        "id": "chain-uuid",
        "name": "My Chain",
        "description": "Optional description",
        "nodes": [...]
    }
    """
    try:
        data = await request.json()

        # Validate required fields
        if 'id' not in data:
            return web.json_response({
                "success": False,
                "error": "Missing required field: id"
            }, status=400)

        if 'name' not in data:
            return web.json_response({
                "success": False,
                "error": "Missing required field: name"
            }, status=400)

        # Validate name is not empty
        if not data['name'].strip():
            return web.json_response({
                "success": False,
                "error": "Chain name cannot be empty"
            }, status=400)

        result = save_chain(data)

        if result['success']:
            return web.json_response({
                "success": True,
                "chain": result['chain'],
                "message": "Chain saved successfully"
            })
        else:
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=500)

    except json.JSONDecodeError:
        return web.json_response({
            "success": False,
            "error": "Invalid JSON data"
        }, status=400)
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to save chain: {str(e)}"
        }, status=500)

async def delete_workflow_chain(request):
    """
    Delete a workflow chain
    DELETE /comfymobile/api/chains/delete

    Expected JSON body:
    {
        "chain_id": "chain-uuid"
    }
    """
    try:
        data = await request.json()

        chain_id = data.get('chain_id')

        if not chain_id:
            return web.json_response({
                "success": False,
                "error": "Missing required field: chain_id"
            }, status=400)

        result = delete_chain(chain_id)

        if result['success']:
            # Also delete thumbnails
            delete_chain_thumbnails(chain_id)

            return web.json_response({
                "success": True,
                "message": result.get('message', 'Chain deleted successfully')
            })
        else:
            status_code = 404 if "not found" in result.get('error', '').lower() else 500
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=status_code)

    except json.JSONDecodeError:
        return web.json_response({
            "success": False,
            "error": "Invalid JSON data"
        }, status=400)
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to delete chain: {str(e)}"
        }, status=500)

async def get_chain_summary_api(request):
    """
    Get chain summary (without full node data)
    GET /comfymobile/api/chains/summary/{chain_id}
    """
    try:
        chain_id = request.match_info.get('chain_id')

        if not chain_id:
            return web.json_response({
                "success": False,
                "error": "Missing chain_id parameter"
            }, status=400)

        result = get_chain_summary(chain_id)

        if result['success']:
            return web.json_response({
                "success": True,
                "summary": result['summary']
            })
        else:
            status_code = 404 if "not found" in result.get('error', '').lower() else 500
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=status_code)

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to get chain summary: {str(e)}"
        }, status=500)

async def execute_chain_api(request):
    """
    Execute a workflow chain
    POST /comfymobile/api/chains/execute

    Expected JSON body:
    {
        "chain_id": "chain-uuid"
    }

    Returns:
    {
        "success": true,
        "executionId": "exec-xxxxx",
        "status": "completed",
        "nodeResults": [...]
    }
    """
    try:
        data = await request.json()

        chain_id = data.get('chain_id')

        if not chain_id:
            return web.json_response({
                "success": False,
                "error": "Missing required field: chain_id"
            }, status=400)

        # Load chain data
        result = load_chain(chain_id)

        if not result['success']:
            status_code = 404 if "not found" in result.get('error', '').lower() else 500
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=status_code)

        chain_data = result['chain']

        # Import executor
        try:
            from ..utils.chain_executor import ChainExecutor
        except ImportError:
            from utils.chain_executor import ChainExecutor

        # Execute chain
        executor = ChainExecutor(chain_data, server_url="http://127.0.0.1:8188")
        execution_result = await executor.execute()

        if execution_result.get('success'):
            return web.json_response(execution_result)
        else:
            return web.json_response(execution_result, status=500)

    except json.JSONDecodeError:
        return web.json_response({
            "success": False,
            "error": "Invalid JSON data"
        }, status=400)
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to execute chain: {str(e)}"
        }, status=500)

async def interrupt_chain_api(request):
    """
    Interrupt currently executing chain
    POST /comfymobile/api/chains/interrupt

    Sends interrupt signal to ComfyUI and clears chain execution state

    Returns:
    {
        "success": true,
        "message": "Chain execution interrupted"
    }
    """
    try:
        # Import required modules
        try:
            from ..utils.chain_executor import ChainExecutor
        except ImportError:
            from utils.chain_executor import ChainExecutor

        # Call interrupt method
        result = await ChainExecutor.interrupt_execution()

        if result.get('success'):
            return web.json_response({
                "success": True,
                "message": "Chain execution interrupted"
            })
        else:
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Failed to interrupt')
            }, status=500)

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to interrupt chain: {str(e)}"
        }, status=500)

async def save_chain_thumbnail_api(request):
    """
    Save a thumbnail for a workflow node in the chain
    POST /comfymobile/api/chains/thumbnails

    Expected JSON body:
    {
        "chain_id": "chain-uuid",
        "node_id": "node-uuid",
        "thumbnail": "data:image/png;base64,..."
    }
    """
    try:
        data = await request.json()

        chain_id = data.get('chain_id')
        node_id = data.get('node_id')
        thumbnail = data.get('thumbnail')

        if not chain_id:
            return web.json_response({
                "success": False,
                "error": "Missing required field: chain_id"
            }, status=400)

        if not node_id:
            return web.json_response({
                "success": False,
                "error": "Missing required field: node_id"
            }, status=400)

        if not thumbnail:
            return web.json_response({
                "success": False,
                "error": "Missing required field: thumbnail"
            }, status=400)

        result = save_chain_thumbnail(chain_id, node_id, thumbnail)

        if result['success']:
            return web.json_response({
                "success": True,
                "thumbnailUrl": result['thumbnailUrl']
            })
        else:
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status=500)

    except json.JSONDecodeError:
        return web.json_response({
            "success": False,
            "error": "Invalid JSON data"
        }, status=400)
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to save thumbnail: {str(e)}"
        }, status=500)

async def get_chain_thumbnail_api(request):
    """
    Get thumbnail for a workflow node in the chain
    GET /comfymobile/api/chains/thumbnails/{chain_id}/{node_id}.png
    """
    try:
        chain_id = request.match_info.get('chain_id')
        node_filename = request.match_info.get('node_filename')

        if not chain_id or not node_filename:
            return web.json_response({
                "success": False,
                "error": "Missing parameters"
            }, status=400)

        # Extract node_id from filename
        node_id = node_filename.replace('.png', '')

        result = get_chain_thumbnail(chain_id, node_id)

        if result['success']:
            filepath = result['filepath']
            return web.FileResponse(filepath)
        else:
            return web.json_response({
                "success": False,
                "error": result.get('error', 'Thumbnail not found')
            }, status=404)

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to get thumbnail: {str(e)}"
        }, status=500)