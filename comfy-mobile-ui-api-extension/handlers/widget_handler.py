"""
Widget Type Management Handler
Handles custom widget type definitions for dynamic form generation
"""

import os
import json
from typing import Dict, List, Any, Optional
from aiohttp import web
import folder_paths
from ..utils.file_utils import get_file_info

def get_widget_types_directory() -> str:
    """Get the widget types directory path"""
    return os.path.join(folder_paths.base_path, "mobile_data", "custom_widget_types")

def ensure_widget_types_directory() -> str:
    """Ensure widget types directory exists and return path"""
    widget_types_dir = get_widget_types_directory()
    os.makedirs(widget_types_dir, exist_ok=True)
    return widget_types_dir

async def get_all_widget_types(request):
    """Get all custom widget type definitions"""
    try:
        widget_types_dir = get_widget_types_directory()
        widget_types = []
        
        if os.path.exists(widget_types_dir):
            for file in os.listdir(widget_types_dir):
                if file.endswith('.json'):
                    file_path = os.path.join(widget_types_dir, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            widget_type = json.load(f)
                        
                        widget_types.append(widget_type)
                    except Exception as e:
                        print(f"Error reading widget type file {file}: {e}")
                        continue
        
        print(f"DEBUG: Sending widget_types to client: {widget_types}")
        return web.json_response({
            'success': True,
            'widgetTypes': widget_types,
            'count': len(widget_types)
        })
        
    except Exception as e:
        print(f"Error listing widget types: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def get_widget_type(request):
    """Get a specific widget type by ID"""
    try:
        widget_type_id = request.match_info.get('id')
        if not widget_type_id:
            return web.json_response({
                'success': False,
                'error': 'Widget type ID is required'
            }, status=400)
        
        widget_types_dir = get_widget_types_directory()
        file_path = os.path.join(widget_types_dir, f"{widget_type_id}.json")
        
        if not os.path.exists(file_path):
            return web.json_response({
                'success': False,
                'error': 'Widget type not found'
            }, status=404)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            widget_type = json.load(f)
        
        return web.json_response(widget_type)
        
    except Exception as e:
        print(f"Error getting widget type {widget_type_id}: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def create_widget_type(request):
    """Create a new widget type definition"""
    try:
        data = await request.json()
        
        # Validate required fields
        if not data.get('id'):
            return web.json_response({
                'success': False,
                'error': 'Widget type ID is required'
            }, status=400)
        
        
        if not data.get('fields'):
            return web.json_response({
                'success': False,
                'error': 'Widget type fields are required'
            }, status=400)
        
        widget_types_dir = ensure_widget_types_directory()
        file_path = os.path.join(widget_types_dir, f"{data['id']}.json")
        
        # Check if widget type already exists
        if os.path.exists(file_path):
            return web.json_response({
                'success': False,
                'error': f'Widget type with ID "{data["id"]}" already exists'
            }, status=409)
        
        # Add metadata
        import datetime
        data['createdAt'] = datetime.datetime.now().isoformat()
        data['updatedAt'] = data['createdAt']
        data['version'] = data.get('version', 1)
        
        # Save widget type
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"Created widget type: {data['id']}")
        return web.json_response(data)
        
    except json.JSONDecodeError:
        return web.json_response({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        print(f"Error creating widget type: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def update_widget_type(request):
    """Update an existing widget type definition"""
    try:
        widget_type_id = request.match_info.get('id')
        if not widget_type_id:
            return web.json_response({
                'success': False,
                'error': 'Widget type ID is required'
            }, status=400)
        
        data = await request.json()
        
        # Validate required fields
        
        if not data.get('fields'):
            return web.json_response({
                'success': False,
                'error': 'Widget type fields are required'
            }, status=400)
        
        widget_types_dir = ensure_widget_types_directory()
        file_path = os.path.join(widget_types_dir, f"{widget_type_id}.json")
        
        # Read existing widget type to preserve createdAt
        created_at = None
        version = 1
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                    created_at = existing.get('createdAt')
                    version = existing.get('version', 1) + 1
            except Exception:
                pass
        
        # Update metadata
        import datetime
        data['id'] = widget_type_id  # Ensure ID matches
        if created_at:
            data['createdAt'] = created_at
        else:
            data['createdAt'] = datetime.datetime.now().isoformat()
        data['updatedAt'] = datetime.datetime.now().isoformat()
        data['version'] = version
        
        # Save updated widget type
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"Updated widget type: {widget_type_id}")
        return web.json_response(data)
        
    except json.JSONDecodeError:
        return web.json_response({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        print(f"Error updating widget type {widget_type_id}: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def delete_widget_type(request):
    """Delete a widget type definition"""
    try:
        widget_type_id = request.match_info.get('id')
        if not widget_type_id:
            return web.json_response({
                'success': False,
                'error': 'Widget type ID is required'
            }, status=400)
        
        widget_types_dir = get_widget_types_directory()
        file_path = os.path.join(widget_types_dir, f"{widget_type_id}.json")
        
        if not os.path.exists(file_path):
            return web.json_response({
                'success': False,
                'error': 'Widget type not found'
            }, status=404)
        
        # Delete the file
        os.remove(file_path)
        
        print(f"Deleted widget type: {widget_type_id}")
        return web.json_response({
            'success': True,
            'message': f'Widget type "{widget_type_id}" deleted successfully'
        })
        
    except Exception as e:
        print(f"Error deleting widget type {widget_type_id}: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)