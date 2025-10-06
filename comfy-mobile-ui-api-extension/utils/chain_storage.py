"""
Chain Storage Utilities

Handles storage and retrieval of workflow chains in mobile_data/workflow_chains/
Similar pattern to snapshot_handler.py using mobile_data/snapshots/
"""

import os
import json
import base64
from datetime import datetime
from typing import Dict, List, Any, Optional

def get_mobile_data_path():
    """Get the mobile_data directory path"""
    try:
        import folder_paths
        comfy_path = os.path.dirname(folder_paths.__file__)
        return os.path.join(comfy_path, "mobile_data")
    except:
        # Fallback if folder_paths is not available
        current_dir = os.path.dirname(os.path.abspath(__file__))
        comfy_path = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        return os.path.join(comfy_path, "mobile_data")

def get_workflow_chains_directory_path():
    """Get the workflow_chains directory path"""
    mobile_data_path = get_mobile_data_path()
    return os.path.join(mobile_data_path, "workflow_chains")

def get_chain_thumbnails_directory_path(chain_id: str):
    """Get the thumbnails directory path for a specific chain"""
    chains_path = get_workflow_chains_directory_path()
    return os.path.join(chains_path, chain_id, "thumbnails")

def ensure_workflow_chains_directory():
    """Ensure workflow_chains directory exists"""
    chains_path = get_workflow_chains_directory_path()
    os.makedirs(chains_path, exist_ok=True)
    return chains_path

def save_chain(chain_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save a workflow chain to JSON file

    Args:
        chain_data: Chain data dict with id, name, description, nodes, etc.

    Returns:
        Dict with success status and saved chain data
    """
    try:
        # Validate required fields
        if 'id' not in chain_data:
            return {
                "success": False,
                "error": "Missing required field: id"
            }

        if 'name' not in chain_data:
            return {
                "success": False,
                "error": "Missing required field: name"
            }

        chain_id = chain_data['id']

        # Ensure directory exists
        ensure_workflow_chains_directory()
        chains_path = get_workflow_chains_directory_path()

        # Update timestamps
        now = datetime.now().isoformat()
        if 'createdAt' not in chain_data:
            chain_data['createdAt'] = now
        chain_data['modifiedAt'] = now

        # Generate filename: {chain_id}.json
        filename = f"{chain_id}.json"
        filepath = os.path.join(chains_path, filename)

        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(chain_data, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "chain": chain_data,
            "filepath": filepath
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to save chain: {str(e)}"
        }

def load_chain(chain_id: str) -> Dict[str, Any]:
    """
    Load a workflow chain from JSON file

    Args:
        chain_id: Chain ID

    Returns:
        Dict with success status and chain data
    """
    try:
        chains_path = get_workflow_chains_directory_path()
        filename = f"{chain_id}.json"
        filepath = os.path.join(chains_path, filename)

        if not os.path.exists(filepath):
            return {
                "success": False,
                "error": f"Chain not found: {chain_id}"
            }

        with open(filepath, 'r', encoding='utf-8') as f:
            chain_data = json.load(f)

        return {
            "success": True,
            "chain": chain_data
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to load chain: {str(e)}"
        }

def delete_chain(chain_id: str) -> Dict[str, Any]:
    """
    Delete a workflow chain file

    Args:
        chain_id: Chain ID

    Returns:
        Dict with success status
    """
    try:
        chains_path = get_workflow_chains_directory_path()
        filename = f"{chain_id}.json"
        filepath = os.path.join(chains_path, filename)

        if not os.path.exists(filepath):
            return {
                "success": False,
                "error": f"Chain not found: {chain_id}"
            }

        os.remove(filepath)

        return {
            "success": True,
            "message": f"Chain deleted: {chain_id}"
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to delete chain: {str(e)}"
        }

def list_chains() -> Dict[str, Any]:
    """
    List all workflow chains

    Returns:
        Dict with success status and list of chains
    """
    try:
        chains_path = get_workflow_chains_directory_path()

        # Ensure directory exists
        ensure_workflow_chains_directory()

        chains = []

        # List all JSON files in the directory
        if os.path.exists(chains_path):
            for filename in os.listdir(chains_path):
                if filename.endswith('.json'):
                    filepath = os.path.join(chains_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            chain_data = json.load(f)
                            chains.append(chain_data)
                    except Exception as e:
                        print(f"Warning: Failed to load chain file {filename}: {e}")
                        continue

        # Sort by modifiedAt (newest first)
        chains.sort(key=lambda x: x.get('modifiedAt', ''), reverse=True)

        return {
            "success": True,
            "chains": chains,
            "count": len(chains)
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to list chains: {str(e)}"
        }

def get_chain_summary(chain_id: str) -> Dict[str, Any]:
    """
    Get chain summary (without full node data)

    Args:
        chain_id: Chain ID

    Returns:
        Dict with success status and chain summary
    """
    try:
        result = load_chain(chain_id)

        if not result['success']:
            return result

        chain_data = result['chain']

        # Create summary without full node data
        summary = {
            'id': chain_data.get('id'),
            'name': chain_data.get('name'),
            'description': chain_data.get('description'),
            'createdAt': chain_data.get('createdAt'),
            'modifiedAt': chain_data.get('modifiedAt'),
            'nodeCount': len(chain_data.get('nodes', []))
        }

        return {
            "success": True,
            "summary": summary
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to get chain summary: {str(e)}"
        }

def save_chain_thumbnail(chain_id: str, node_id: str, thumbnail_data: str) -> Dict[str, Any]:
    """
    Save a thumbnail image for a workflow node in the chain

    Args:
        chain_id: Chain ID
        node_id: Node ID within the chain
        thumbnail_data: Base64 encoded image data (with or without data URI prefix)

    Returns:
        Dict with success status and thumbnail URL
    """
    try:
        # Create thumbnails directory for this chain
        thumbnails_path = get_chain_thumbnails_directory_path(chain_id)
        os.makedirs(thumbnails_path, exist_ok=True)

        # Remove data URI prefix if present
        if ',' in thumbnail_data:
            thumbnail_data = thumbnail_data.split(',', 1)[1]

        # Decode base64 image data
        image_bytes = base64.b64decode(thumbnail_data)

        # Save as PNG file
        filename = f"{node_id}.png"
        filepath = os.path.join(thumbnails_path, filename)

        with open(filepath, 'wb') as f:
            f.write(image_bytes)

        # Return relative URL path
        thumbnail_url = f"/comfymobile/api/chains/thumbnails/{chain_id}/{node_id}.png"

        return {
            "success": True,
            "thumbnailUrl": thumbnail_url
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to save thumbnail: {str(e)}"
        }

def get_chain_thumbnail(chain_id: str, node_id: str) -> Dict[str, Any]:
    """
    Get thumbnail file path for a workflow node in the chain

    Args:
        chain_id: Chain ID
        node_id: Node ID within the chain

    Returns:
        Dict with success status and file path
    """
    try:
        thumbnails_path = get_chain_thumbnails_directory_path(chain_id)
        filename = f"{node_id}.png"
        filepath = os.path.join(thumbnails_path, filename)

        if not os.path.exists(filepath):
            return {
                "success": False,
                "error": "Thumbnail not found"
            }

        return {
            "success": True,
            "filepath": filepath
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to get thumbnail: {str(e)}"
        }

def delete_chain_thumbnails(chain_id: str) -> Dict[str, Any]:
    """
    Delete all thumbnails for a chain

    Args:
        chain_id: Chain ID

    Returns:
        Dict with success status
    """
    try:
        thumbnails_path = get_chain_thumbnails_directory_path(chain_id)

        if os.path.exists(thumbnails_path):
            import shutil
            shutil.rmtree(thumbnails_path)

        return {
            "success": True,
            "message": f"Thumbnails deleted for chain: {chain_id}"
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to delete thumbnails: {str(e)}"
        }