"""
Node Input Mapping Handler
Handles custom node input mappings for dynamic widget assignment
"""

import os
import json
from typing import Dict, List, Any, Optional
from aiohttp import web
import folder_paths
from ..utils.file_utils import get_file_info

def get_node_mappings_directory() -> str:
    """Get the node mappings directory path"""
    return os.path.join(folder_paths.base_path, "mobile_data", "custom_node_mappings")

def ensure_node_mappings_directory() -> str:
    """Ensure node mappings directory exists and return path"""
    node_mappings_dir = get_node_mappings_directory()
    os.makedirs(node_mappings_dir, exist_ok=True)
    return node_mappings_dir

def generate_mapping_filename(node_type: str, scope: Dict[str, Any]) -> str:
    """Generate filename based on scope information"""
    # Sanitize node type for filename
    safe_node_type = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in node_type)
    
    scope_type = scope.get('type', 'global')
    
    if scope_type == 'global':
        return f"global_{safe_node_type}.json"
    elif scope_type == 'workflow':
        workflow_id = scope.get('workflowId', 'unknown')
        # Sanitize workflow ID for filename
        safe_workflow_id = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in str(workflow_id))
        return f"{safe_workflow_id}_{safe_node_type}.json"
    elif scope_type == 'specific':
        workflow_id = scope.get('workflowId', 'unknown')
        node_id = scope.get('nodeId', 'unknown')
        # Sanitize IDs for filename
        safe_workflow_id = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in str(workflow_id))
        safe_node_id = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in str(node_id))
        return f"{safe_workflow_id}_{safe_node_id}_{safe_node_type}.json"
    else:
        # Fallback to global pattern
        return f"global_{safe_node_type}.json"

def parse_scope_from_filename(filename: str) -> Dict[str, Any]:
    """Parse scope information from filename"""
    # Remove .json extension
    name_part = filename[:-5] if filename.endswith('.json') else filename
    
    # Split by underscore
    parts = name_part.split('_')
    
    if len(parts) >= 2 and parts[0] == 'global':
        # global_nodetype pattern
        return {'type': 'global'}
    elif len(parts) >= 3:
        # Check if it's workflow_nodetype (2 parts after splitting nodetype) 
        # or workflow_nodeid_nodetype (3+ parts)
        if len(parts) == 3:
            # This could be either workflow_nodetype or workflow_nodeid_nodetype
            # We need to distinguish: if middle part looks like node ID, it's specific
            # Otherwise, it's workflow scope with compound nodetype name
            # For now, assume it's workflow_nodeid_nodetype pattern (specific node)
            return {
                'type': 'specific',
                'workflowId': parts[0],
                'nodeId': parts[1]
            }
        else:
            # More than 3 parts - definitely workflow_nodeid_nodetype pattern
            return {
                'type': 'specific',
                'workflowId': parts[0],
                'nodeId': parts[1]
            }
    elif len(parts) == 2 and parts[0] != 'global':
        # workflow_nodetype pattern
        return {
            'type': 'workflow',
            'workflowId': parts[0]
        }
    
    # Fallback to global if pattern doesn't match
    return {'type': 'global'}

async def get_all_node_mappings(request):
    """Get all custom node input mappings"""
    try:
        node_mappings_dir = get_node_mappings_directory()
        node_mappings = []
        
        if os.path.exists(node_mappings_dir):
            for file in os.listdir(node_mappings_dir):
                if file.endswith('.json'):
                    file_path = os.path.join(node_mappings_dir, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            node_mapping = json.load(f)
                        
                        # Ensure scope information is present
                        if 'scope' not in node_mapping:
                            # Parse scope from filename as fallback
                            node_mapping['scope'] = parse_scope_from_filename(file)
                        
                        node_mappings.append(node_mapping)
                    except Exception as e:
                        print(f"Error reading node mapping file {file}: {e}")
                        continue
        
        print(f"DEBUG: Sending {len(node_mappings)} node_mappings to client")
        return web.json_response(node_mappings)
        
    except Exception as e:
        print(f"Error listing node mappings: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def save_node_mapping(request):
    """Save a custom node input mapping"""
    try:
        data = await request.json()
        
        # Validate required fields
        if not data.get('nodeType'):
            return web.json_response({
                'success': False,
                'error': 'Node type is required'
            }, status=400)
        
        node_type = data['nodeType']
        scope = data.get('scope', {'type': 'global'})  # Default to global scope
        node_mappings_dir = ensure_node_mappings_directory()
        
        # Generate filename based on scope
        filename = generate_mapping_filename(node_type, scope)
        file_path = os.path.join(node_mappings_dir, filename)
        
        # Prepare data structure with scope information
        mapping_data = {
            'nodeType': node_type,
            'scope': scope,
            'inputMappings': data.get('inputMappings', {}),
            'customFields': []
        }
        
        # Process customFields - remove defaultValue and fieldType, keep only fieldName and assignedWidgetType
        if 'customFields' in data and isinstance(data['customFields'], list):
            for field in data['customFields']:
                if 'fieldName' in field and 'assignedWidgetType' in field:
                    mapping_data['customFields'].append({
                        'fieldName': field['fieldName'],
                        'assignedWidgetType': field['assignedWidgetType']
                    })
        
        # Check if mapping already exists to preserve createdAt
        import datetime
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                    mapping_data['createdAt'] = existing.get('createdAt', datetime.datetime.now().isoformat())
            except Exception:
                mapping_data['createdAt'] = datetime.datetime.now().isoformat()
        else:
            mapping_data['createdAt'] = datetime.datetime.now().isoformat()
        
        mapping_data['updatedAt'] = datetime.datetime.now().isoformat()
        
        # Save node mapping
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(mapping_data, f, indent=2, ensure_ascii=False)
        
        print(f"Saved node mapping for: {node_type}")
        print(f"Scope: {scope['type']}")
        print(f"Filename: {filename}")
        print(f"Input mappings: {len(mapping_data['inputMappings'])} fields")
        print(f"Custom fields: {len(mapping_data['customFields'])} fields")
        
        return web.json_response({
            'success': True,
            'message': f'Node mapping for "{node_type}" saved successfully',
            'data': mapping_data
        })
        
    except json.JSONDecodeError:
        return web.json_response({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        print(f"Error saving node mapping: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def get_node_mapping(request):
    """Get a specific node mapping by node type (returns first matching scope)"""
    try:
        node_type = request.match_info.get('nodeType')
        if not node_type:
            return web.json_response({
                'success': False,
                'error': 'Node type is required'
            }, status=400)
        
        node_mappings_dir = get_node_mappings_directory()
        
        if not os.path.exists(node_mappings_dir):
            return web.json_response({
                'success': False,
                'error': 'No node mappings directory found'
            }, status=404)
        
        # Sanitize node type for comparison
        safe_node_type = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in node_type)
        
        # Find first matching file for this node type
        matching_file = None
        for file in os.listdir(node_mappings_dir):
            if file.endswith('.json'):
                name_part = file[:-5]  # Remove .json
                if (name_part.endswith(f"_{safe_node_type}") or 
                    name_part == f"global_{safe_node_type}"):
                    matching_file = file
                    break
        
        if not matching_file:
            return web.json_response({
                'success': False,
                'error': 'Node mapping not found'
            }, status=404)
        
        file_path = os.path.join(node_mappings_dir, matching_file)
        with open(file_path, 'r', encoding='utf-8') as f:
            node_mapping = json.load(f)
        
        # Ensure scope information is present
        if 'scope' not in node_mapping:
            node_mapping['scope'] = parse_scope_from_filename(matching_file)
        
        return web.json_response(node_mapping)
        
    except Exception as e:
        print(f"Error getting node mapping {node_type}: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def delete_node_mapping(request):
    """Delete a specific node mapping by scope information"""
    try:
        # Check if this is a POST request with scope data
        if request.method == 'POST':
            data = await request.json()
            node_type = data.get('nodeType')
            scope = data.get('scope', {})
        else:
            # Fallback to URL parameter for backward compatibility
            node_type = request.match_info.get('nodeType')
            scope = {'type': 'global'}  # Default to global for backward compatibility
        
        if not node_type:
            return web.json_response({
                'success': False,
                'error': 'Node type is required'
            }, status=400)
        
        node_mappings_dir = get_node_mappings_directory()
        
        if not os.path.exists(node_mappings_dir):
            return web.json_response({
                'success': False,
                'error': 'No node mappings directory found'
            }, status=404)
        
        # Generate the specific filename for this scope
        filename = generate_mapping_filename(node_type, scope)
        file_path = os.path.join(node_mappings_dir, filename)
        
        if not os.path.exists(file_path):
            return web.json_response({
                'success': False,
                'error': f'Node mapping not found for scope: {scope["type"]}'
            }, status=404)
        
        # Delete the specific file
        os.remove(file_path)
        
        print(f"Deleted node mapping: {node_type}")
        print(f"Scope: {scope}")
        print(f"Filename: {filename}")
        
        return web.json_response({
            'success': True,
            'message': f'Node mapping for "{node_type}" (scope: {scope["type"]}) deleted successfully',
            'deleted_file': filename
        })
        
    except json.JSONDecodeError:
        return web.json_response({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        print(f"Error deleting node mapping for {node_type}: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def delete_all_node_mappings_by_type(request):
    """Delete all node mappings by node type (all scopes) - for bulk deletion"""
    try:
        node_type = request.match_info.get('nodeType')
        if not node_type:
            return web.json_response({
                'success': False,
                'error': 'Node type is required'
            }, status=400)
        
        node_mappings_dir = get_node_mappings_directory()
        
        if not os.path.exists(node_mappings_dir):
            return web.json_response({
                'success': False,
                'error': 'No node mappings directory found'
            }, status=404)
        
        # Sanitize node type for comparison
        safe_node_type = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in node_type)
        
        # Find all files that belong to this node type (across all scopes)
        files_to_delete = []
        for file in os.listdir(node_mappings_dir):
            if file.endswith('.json'):
                # Check if this file belongs to the node type
                name_part = file[:-5]  # Remove .json
                if (name_part.endswith(f"_{safe_node_type}") or 
                    name_part == f"global_{safe_node_type}"):
                    files_to_delete.append(file)
        
        if not files_to_delete:
            return web.json_response({
                'success': False,
                'error': 'No node mappings found for this node type'
            }, status=404)
        
        # Delete all matching files
        deleted_files = []
        for file in files_to_delete:
            try:
                file_path = os.path.join(node_mappings_dir, file)
                os.remove(file_path)
                deleted_files.append(file)
            except Exception as e:
                print(f"Error deleting file {file}: {e}")
                continue
        
        print(f"Deleted {len(deleted_files)} node mapping files for: {node_type}")
        print(f"Deleted files: {deleted_files}")
        
        return web.json_response({
            'success': True,
            'message': f'Deleted {len(deleted_files)} node mappings for "{node_type}"',
            'deleted_files': deleted_files
        })
        
    except Exception as e:
        print(f"Error deleting node mappings for {node_type}: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)