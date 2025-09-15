
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from aiohttp import web
from .lora_handler import get_mobile_data_path

def get_backup_directory_path():
    """Get the backup directory path"""
    mobile_data_path = get_mobile_data_path()
    return os.path.join(mobile_data_path, "backup")

def ensure_backup_directory():
    """Ensure backup directory exists"""
    backup_path = get_backup_directory_path()
    os.makedirs(backup_path, exist_ok=True)
    return backup_path

async def get_backup_status(request):
    """Check if browser data backup exists"""
    try:
        backup_path = get_backup_directory_path()
        backup_file = os.path.join(backup_path, "browser_data_backup.json")
        
        if os.path.exists(backup_file):
            # Get file stats
            file_stats = os.stat(backup_file)
            created_at = datetime.fromtimestamp(file_stats.st_mtime).isoformat()
            
            return web.json_response({
                "success": True,
                "hasBackup": True,
                "createdAt": created_at,
                "size": file_stats.st_size
            })
        else:
            return web.json_response({
                "success": True,
                "hasBackup": False
            })
            
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to check backup status: {str(e)}",
            "hasBackup": False
        }, status=500)

async def create_browser_data_backup(request):
    """Backup browser data to server"""
    try:
        # Parse request data
        backup_data = await request.json()
        
        # Ensure backup directory exists
        ensure_backup_directory()
        backup_path = get_backup_directory_path()
        backup_file = os.path.join(backup_path, "browser_data_backup.json")
        
        # Add metadata
        backup_content = {
            "created_at": datetime.now().isoformat(),
            "version": "1.0",
            "data": backup_data
        }
        
        # Save backup file
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_content, f, indent=2, ensure_ascii=False)
        
        # Get file size for response
        file_size = os.path.getsize(backup_file)
        
        print(f"[BACKUP] Browser data backup created successfully: {backup_file}")
        
        return web.json_response({
            "success": True,
            "message": "Browser data backed up successfully",
            "createdAt": backup_content["created_at"],
            "size": file_size
        })
        
    except Exception as e:
        print(f"[BACKUP] Error creating browser data backup: {str(e)}")
        return web.json_response({
            "success": False,
            "error": f"Failed to create backup: {str(e)}"
        }, status=500)

async def restore_browser_data_backup(request):
    """Restore browser data from server backup"""
    try:
        backup_path = get_backup_directory_path()
        backup_file = os.path.join(backup_path, "browser_data_backup.json")
        
        # Check if backup file exists
        if not os.path.exists(backup_file):
            return web.json_response({
                "success": False,
                "error": "No backup file found. Please create a backup first."
            }, status=404)
        
        # Load backup data
        with open(backup_file, 'r', encoding='utf-8') as f:
            backup_content = json.load(f)
        
        # Extract the actual data
        restored_data = backup_content.get("data", {})
        
        print(f"[BACKUP] Browser data restore requested from: {backup_file}")
        
        return web.json_response({
            "success": True,
            "message": "Browser data restored successfully",
            "localStorage": restored_data.get("localStorage", {}),
            "indexedDB": restored_data.get("indexedDB", {}),
            "restoredAt": datetime.now().isoformat(),
            "originalCreatedAt": backup_content.get("created_at")
        })
        
    except Exception as e:
        print(f"[BACKUP] Error restoring browser data: {str(e)}")
        return web.json_response({
            "success": False,
            "error": f"Failed to restore backup: {str(e)}"
        }, status=500)
