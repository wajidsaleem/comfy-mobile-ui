
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from aiohttp import web
from .lora_handler import get_mobile_data_path

def get_snapshots_directory_path():
    """Get the snapshots directory path"""
    mobile_data_path = get_mobile_data_path()
    return os.path.join(mobile_data_path, "snapshots")

def ensure_snapshots_directory():
    """Ensure snapshots directory exists"""
    snapshots_path = get_snapshots_directory_path()
    os.makedirs(snapshots_path, exist_ok=True)
    return snapshots_path

async def save_workflow_snapshot(request):
    """Save a workflow snapshot"""
    try:
        data = await request.json()
        
        # Validate required parameters
        required_fields = ['workflow_id', 'title', 'workflow_snapshot']
        for field in required_fields:
            if field not in data:
                return web.json_response({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }, status=400)
        
        workflow_id = data['workflow_id']
        title = data['title'].strip()
        workflow_snapshot = data['workflow_snapshot']
        
        # Validate title
        if not title:
            return web.json_response({
                "success": False,
                "error": "Title cannot be empty"
            }, status=400)
        
        # Ensure snapshots directory exists
        ensure_snapshots_directory()
        snapshots_path = get_snapshots_directory_path()
        
        # Generate filename: workflowId_yyyyMMddHHmmss.json
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"{workflow_id}_{timestamp}.json"
        file_path = os.path.join(snapshots_path, filename)
        
        # Create snapshot data
        snapshot_data = {
            "workflow_id": workflow_id,
            "title": title,
            "createdAt": datetime.now().isoformat(),
            "workflow_snapshot": workflow_snapshot
        }
        
        # Save to file
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(snapshot_data, f, indent=2, ensure_ascii=False)
                
            print(f"[SNAPSHOT] Saved workflow snapshot: {filename}")
            
            return web.json_response({
                "success": True,
                "message": f"Workflow snapshot saved successfully: {title}",
                "filename": filename,
                "snapshot": snapshot_data
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": f"Failed to save snapshot file: {str(e)}"
            }, status=500)
        
    except json.JSONDecodeError as e:
        return web.json_response({
            "success": False,
            "error": f"Invalid JSON in request: {str(e)}"
        }, status=400)
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }, status=500)

async def load_workflow_snapshot(request):
    """Load a specific workflow snapshot"""
    try:
        filename = request.match_info['filename']
        
        snapshots_path = get_snapshots_directory_path()
        file_path = os.path.join(snapshots_path, filename)
        
        # Validate file exists
        if not os.path.exists(file_path):
            return web.json_response({
                "success": False,
                "error": f"Snapshot file not found: {filename}"
            }, status=404)
        
        # Load snapshot data
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                snapshot_data = json.load(f)
                
            return web.json_response({
                "success": True,
                "message": f"Snapshot loaded successfully: {snapshot_data.get('title', filename)}",
                "snapshot": snapshot_data
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": f"Failed to load snapshot file: {str(e)}"
            }, status=500)
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }, status=500)

async def list_all_snapshots(request):
    """List all workflow snapshots"""
    try:
        snapshots_path = get_snapshots_directory_path()
        
        if not os.path.exists(snapshots_path):
            return web.json_response({
                "success": True,
                "message": "No snapshots directory found",
                "snapshots": [],
                "total_count": 0
            })
        
        snapshots = []
        
        # Read all JSON files in snapshots directory
        for filename in os.listdir(snapshots_path):
            if filename.endswith('.json'):
                file_path = os.path.join(snapshots_path, filename)
                try:
                    # Get file stats
                    file_stats = os.stat(file_path)
                    file_size = file_stats.st_size
                    
                    # Load and parse snapshot data
                    with open(file_path, 'r', encoding='utf-8') as f:
                        snapshot_data = json.load(f)
                    
                    snapshots.append({
                        "workflow_id": snapshot_data.get("workflow_id", ""),
                        "title": snapshot_data.get("title", "Untitled"),
                        "createdAt": snapshot_data.get("createdAt", ""),
                        "filename": filename,
                        "fileSize": file_size
                    })
                    
                except Exception as e:
                    print(f"[SNAPSHOT] Error reading snapshot file {filename}: {e}")
                    continue
        
        # Sort by creation date (newest first)
        snapshots.sort(key=lambda x: x['createdAt'], reverse=True)
        
        return web.json_response({
            "success": True,
            "message": f"Found {len(snapshots)} snapshots",
            "snapshots": snapshots,
            "total_count": len(snapshots)
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to list snapshots: {str(e)}",
            "snapshots": [],
            "total_count": 0
        }, status=500)

async def list_snapshots_by_workflow(request):
    """List workflow snapshots for a specific workflow ID"""
    try:
        workflow_id = request.match_info['workflow_id']
        
        snapshots_path = get_snapshots_directory_path()
        
        if not os.path.exists(snapshots_path):
            return web.json_response({
                "success": True,
                "message": f"No snapshots found for workflow: {workflow_id}",
                "workflow_id": workflow_id,
                "snapshots": [],
                "total_count": 0
            })
        
        snapshots = []
        
        # Read all JSON files that match the workflow_id
        for filename in os.listdir(snapshots_path):
            if filename.endswith('.json') and filename.startswith(f"{workflow_id}_"):
                file_path = os.path.join(snapshots_path, filename)
                try:
                    # Get file stats
                    file_stats = os.stat(file_path)
                    file_size = file_stats.st_size
                    
                    # Load and parse snapshot data
                    with open(file_path, 'r', encoding='utf-8') as f:
                        snapshot_data = json.load(f)
                    
                    # Double-check workflow_id matches
                    if snapshot_data.get("workflow_id") == workflow_id:
                        snapshots.append({
                            "workflow_id": workflow_id,
                            "title": snapshot_data.get("title", "Untitled"),
                            "createdAt": snapshot_data.get("createdAt", ""),
                            "filename": filename,
                            "fileSize": file_size
                        })
                    
                except Exception as e:
                    print(f"[SNAPSHOT] Error reading snapshot file {filename}: {e}")
                    continue
        
        # Sort by creation date (newest first)
        snapshots.sort(key=lambda x: x['createdAt'], reverse=True)
        
        return web.json_response({
            "success": True,
            "message": f"Found {len(snapshots)} snapshots for workflow: {workflow_id}",
            "workflow_id": workflow_id,
            "snapshots": snapshots,
            "total_count": len(snapshots)
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to list snapshots for workflow {workflow_id}: {str(e)}",
            "workflow_id": workflow_id,
            "snapshots": [],
            "total_count": 0
        }, status=500)

async def delete_workflow_snapshot(request):
    """Delete a workflow snapshot"""
    try:
        filename = request.match_info['filename']
        
        snapshots_path = get_snapshots_directory_path()
        file_path = os.path.join(snapshots_path, filename)
        
        # Validate file exists
        if not os.path.exists(file_path):
            return web.json_response({
                "success": False,
                "error": f"Snapshot file not found: {filename}"
            }, status=404)
        
        # Get snapshot title for response
        snapshot_title = "Unknown"
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                snapshot_data = json.load(f)
                snapshot_title = snapshot_data.get('title', filename)
        except:
            pass
        
        # Delete the file
        try:
            os.remove(file_path)
            print(f"[SNAPSHOT] Deleted workflow snapshot: {filename}")
            
            return web.json_response({
                "success": True,
                "message": f"Snapshot deleted successfully: {snapshot_title}",
                "filename": filename
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": f"Failed to delete snapshot file: {str(e)}"
            }, status=500)
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }, status=500)

async def rename_workflow_snapshot(request):
    """Rename a workflow snapshot"""
    try:
        filename = request.match_info['filename']
        
        # Parse request body
        try:
            data = await request.json()
            new_title = data.get('title', '').strip()
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": "Invalid JSON in request body"
            }, status=400)
        
        # Validate new title
        if not new_title:
            return web.json_response({
                "success": False,
                "error": "Title is required and cannot be empty"
            }, status=400)
        
        snapshots_path = get_snapshots_directory_path()
        file_path = os.path.join(snapshots_path, filename)
        
        # Validate file exists
        if not os.path.exists(file_path):
            return web.json_response({
                "success": False,
                "error": f"Snapshot file not found: {filename}"
            }, status=404)
        
        # Load current snapshot data
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                snapshot_data = json.load(f)
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": f"Failed to read snapshot file: {str(e)}"
            }, status=500)
        
        # Update title and save
        old_title = snapshot_data.get('title', 'Untitled')
        snapshot_data['title'] = new_title
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(snapshot_data, f, indent=2, ensure_ascii=False)
            
            print(f"[SNAPSHOT] Renamed workflow snapshot: '{old_title}' -> '{new_title}' ({filename})")
            
            return web.json_response({
                "success": True,
                "message": f"Snapshot renamed successfully: '{old_title}' -> '{new_title}'",
                "filename": filename,
                "old_title": old_title,
                "new_title": new_title
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": f"Failed to save updated snapshot: {str(e)}"
            }, status=500)
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }, status=500)
