
import os
import json
import time
import asyncio
import shutil
from typing import Dict, List, Any, Optional
from aiohttp import web
import aiohttp
import aiofiles
import folder_paths
from ..utils.file_utils import (
    extract_filename_from_url, ensure_proper_extension, get_final_filename_from_server
)

# Global variables for download task management
download_task_counter = 0
download_tasks = {}

async def download_model_file(request):
    """Start downloading a model file from URL to specified folder"""
    global download_task_counter, download_tasks
    
    try:
        data = await request.json()
        
        # Validate required parameters
        required_fields = ['url', 'target_folder']
        for field in required_fields:
            if field not in data:
                return web.json_response({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }, status=400)
        
        url = data['url']
        target_folder = data['target_folder']
        filename = data.get('filename')  # Optional - can be extracted from URL
        overwrite = data.get('overwrite', False)
        
        # Validate URL format
        import urllib.parse
        try:
            parsed_url = urllib.parse.urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                return web.json_response({
                    "success": False,
                    "error": "Invalid URL format"
                }, status=400)
        except Exception:
            return web.json_response({
                "success": False,
                "error": "Invalid URL format"
            }, status=400)
        
        # Get final filename - check server's Content-Disposition header first
        if not filename:
            try:
                # Get filename from server's Content-Disposition header with fallback to URL
                filename, response_headers = await get_final_filename_from_server(url)
                print(f"🏷️ Final determined filename: {filename}")
            except Exception as e:
                print(f"⚠️ Error getting filename from server, using URL fallback: {e}")
                filename = extract_filename_from_url(url)
            
            if not filename:
                return web.json_response({
                    "success": False,
                    "error": "Could not determine filename from URL or server headers. Please specify 'filename' parameter."
                }, status=400)
        else:
            # User provided filename - ensure it has proper extension
            print(f"📝 User provided filename: {filename}")
            filename = ensure_proper_extension(filename, None, url)
            print(f"🏷️ Final filename with extension: {filename}")
        
        # Get models directory path
        models_path = os.path.join(folder_paths.base_path, "models")
        
        if not os.path.exists(models_path):
            return web.json_response({
                "success": False,
                "error": "Models directory not found"
            }, status=404)
        
        # Build target paths
        target_folder_path = os.path.join(models_path, target_folder)
        target_file_path = os.path.join(target_folder_path, filename)
        
        # Create target folder if it doesn't exist
        if not os.path.exists(target_folder_path):
            try:
                os.makedirs(target_folder_path, exist_ok=True)
            except Exception as e:
                return web.json_response({
                    "success": False,
                    "error": f"Failed to create target folder: {str(e)}"
                }, status=500)
        
        # Check if target file already exists
        if os.path.exists(target_file_path) and not overwrite:
            return web.json_response({
                "success": False,
                "error": f"Target file already exists: {filename}. Set 'overwrite': true to replace it."
            }, status=409)
        
        # Generate unique task ID
        download_task_counter += 1
        task_id = f"download_{download_task_counter}_{int(time.time())}"
        
        # Check for existing partial download
        temp_path = target_file_path + ".downloading"
        partial_size = 0
        if os.path.exists(temp_path):
            try:
                partial_size = os.path.getsize(temp_path)
            except:
                partial_size = 0
        
        # Create download task info
        task_info = {
            "id": task_id,
            "url": url,
            "filename": filename,
            "target_folder": target_folder,
            "target_path": target_file_path,
            "status": "starting",
            "progress": 0,
            "total_size": 0,
            "downloaded_size": partial_size,
            "speed": 0,
            "eta": 0,
            "created_at": time.time(),
            "started_at": None,
            "completed_at": None,
            "error": None,
            "cancelled": False,
            "supports_resume": False,
            "retry_count": 0,
            "max_retries": 3
        }
        
        download_tasks[task_id] = task_info
        
        # Start download task asynchronously
        asyncio.create_task(perform_download(task_id))
        
        response_data = {
            "success": True,
            "message": "Download started successfully",
            "task_id": task_id,
            "download_info": {
                "url": url,
                "filename": filename,
                "target_folder": target_folder,
                "target_path": target_file_path
            }
        }
        
        if partial_size > 0:
            response_data["message"] = "Download started successfully (resuming partial download)"
            response_data["download_info"]["partial_size"] = partial_size
            response_data["download_info"]["partial_size_mb"] = partial_size / (1024 * 1024)
        
        return web.json_response(response_data)
        
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


async def resume_download(request):
    """Resume a failed or cancelled download"""
    global download_tasks
    
    try:
        task_id = request.match_info['task_id']
        
        if task_id not in download_tasks:
            return web.json_response({
                "success": False,
                "error": f"Download task not found: {task_id}"
            }, status=404)
        
        task = download_tasks[task_id]
        
        # Check if task can be resumed
        if task["status"] not in ["error", "cancelled"]:
            return web.json_response({
                "success": False,
                "error": f"Cannot resume task with status: {task['status']}"
            }, status=400)
        
        # Check if partial file exists
        temp_path = task["target_path"] + ".downloading"
        partial_size = 0
        if os.path.exists(temp_path):
            try:
                partial_size = os.path.getsize(temp_path)
            except:
                partial_size = 0
        
        # Reset task status for resume
        task["status"] = "starting"
        task["cancelled"] = False
        task["error"] = None
        task["downloaded_size"] = partial_size
        task["created_at"] = time.time()  # Update creation time
        task["started_at"] = None
        task["completed_at"] = None
        task["retry_count"] = 0
        
        # Start download task asynchronously
        asyncio.create_task(perform_download(task_id))
        
        response_data = {
            "success": True,
            "message": "Download resumed successfully",
            "task_id": task_id,
            "resume_info": {
                "filename": task["filename"],
                "target_folder": task["target_folder"],
                "partial_size": partial_size,
                "partial_size_mb": partial_size / (1024 * 1024) if partial_size > 0 else 0
            }
        }
        
        return web.json_response(response_data)
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to resume download: {str(e)}"
        }, status=500)

async def retry_all_failed_downloads(request):
    """Retry all failed downloads"""
    global download_tasks
    
    try:
        # Find all failed downloads
        failed_tasks = [task for task in download_tasks.values() 
                       if task["status"] in ["error", "cancelled"]]
        
        if not failed_tasks:
            return web.json_response({
                "success": True,
                "message": "No failed downloads to retry",
                "retried_count": 0
            })
        
        retried_count = 0
        retry_results = []
        
        for task in failed_tasks:
            try:
                # Check if partial file exists
                temp_path = task["target_path"] + ".downloading"
                partial_size = 0
                if os.path.exists(temp_path):
                    try:
                        partial_size = os.path.getsize(temp_path)
                    except:
                        partial_size = 0
                
                # Reset task status for retry
                task["status"] = "starting"
                task["cancelled"] = False
                task["error"] = None
                task["downloaded_size"] = partial_size
                task["created_at"] = time.time()
                task["started_at"] = None
                task["completed_at"] = None
                task["retry_count"] = 0
                
                # Start download task asynchronously
                asyncio.create_task(perform_download(task["id"]))
                retried_count += 1
                
                retry_results.append({
                    "task_id": task["id"],
                    "filename": task["filename"],
                    "status": "restarted",
                    "partial_size": partial_size
                })
                
            except Exception as e:
                retry_results.append({
                    "task_id": task["id"],
                    "filename": task["filename"],
                    "status": "failed_to_restart",
                    "error": str(e)
                })
        
        return web.json_response({
            "success": True,
            "message": f"Retried {retried_count} failed downloads",
            "retried_count": retried_count,
            "total_failed": len(failed_tasks),
            "results": retry_results
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to retry downloads: {str(e)}"
        }, status=500)


async def check_server_support_resume(session, url):
    """Check if server supports HTTP Range requests"""
    try:
        async with session.head(url) as response:
            accept_ranges = response.headers.get('accept-ranges', '').lower()
            return accept_ranges == 'bytes'
    except:
        # If HEAD fails, try a small range request
        try:
            headers = {'Range': 'bytes=0-0'}
            async with session.get(url, headers=headers) as response:
                return response.status == 206
        except:
            return False

async def get_downloaded_size(temp_path):
    """Get size of partially downloaded file"""
    if os.path.exists(temp_path):
        try:
            return os.path.getsize(temp_path)
        except:
            return 0
    return 0

async def perform_download(task_id):
    """Background task to perform the actual download with resume support"""
    global download_tasks
    
    if task_id not in download_tasks:
        return
    
    task = download_tasks[task_id]
    max_retries = task.get("max_retries", 3)
    retry_count = task.get("retry_count", 0)
    
    try:
        task["status"] = "downloading"
        task["started_at"] = time.time()
        
        import aiohttp
        import aiofiles
        
        # Create temp filename to avoid partial files
        temp_path = task["target_path"] + ".downloading"
        
        # Check if partial file exists from previous attempt
        downloaded = await get_downloaded_size(temp_path)
        task["downloaded_size"] = downloaded
        
        print(f"📥 Starting download: {task['filename']}")
        if downloaded > 0:
            print(f"🔄 Resuming from {downloaded:,} bytes")
        
        while retry_count <= max_retries:
            try:
                timeout = aiohttp.ClientTimeout(total=None, connect=30, sock_read=30)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    
                    # Check if server supports resume (cache result in task)
                    if "supports_resume" not in task or task["supports_resume"] is None:
                        supports_resume = await check_server_support_resume(session, task["url"])
                        task["supports_resume"] = supports_resume
                    else:
                        supports_resume = task["supports_resume"]
                    
                    # Prepare headers for resume if supported and needed
                    headers = {}
                    if supports_resume and downloaded > 0:
                        headers['Range'] = f'bytes={downloaded}-'
                        print(f"🔄 Requesting resume from byte {downloaded:,}")
                    elif downloaded > 0 and not supports_resume:
                        print("⚠️ Server doesn't support resume, starting over")
                        downloaded = 0
                        task["downloaded_size"] = 0
                        # Remove partial file since we can't resume
                        try:
                            os.remove(temp_path)
                        except:
                            pass
                    
                    async with session.get(task["url"], headers=headers) as response:
                        # Check response status
                        if headers.get('Range') and response.status == 206:
                            print("✅ Resume request accepted (HTTP 206)")
                        elif headers.get('Range') and response.status == 200:
                            print("⚠️ Resume request ignored, downloading full file")
                            downloaded = 0
                            task["downloaded_size"] = 0
                            # Remove partial file since server sent full content
                            try:
                                os.remove(temp_path)
                            except:
                                pass
                        elif response.status != 200:
                            raise aiohttp.ClientError(f"HTTP {response.status}: {response.reason}")
                        
                        # Get file size
                        if response.status == 206:
                            # For partial content, parse Content-Range header
                            content_range = response.headers.get('content-range', '')
                            if content_range:
                                # Format: "bytes start-end/total"
                                try:
                                    total_size = int(content_range.split('/')[-1])
                                    task["total_size"] = total_size
                                except:
                                    pass
                        else:
                            # For full content, use Content-Length
                            content_length = response.headers.get('content-length')
                            if content_length:
                                task["total_size"] = int(content_length)
                        
                        # Open file for append if resuming, write if starting fresh
                        file_mode = 'ab' if downloaded > 0 else 'wb'
                        
                        # Download file in chunks
                        chunk_size = 64 * 1024  # 64KB chunks for better performance
                        last_time = time.time()
                        last_downloaded = downloaded
                        
                        async with aiofiles.open(temp_path, file_mode) as file:
                            async for chunk in response.content.iter_chunked(chunk_size):
                                if task.get("cancelled", False):
                                    task["status"] = "cancelled"
                                    print(f"❌ Download cancelled: {task['filename']}")
                                    return
                                
                                await file.write(chunk)
                                downloaded += len(chunk)
                                task["downloaded_size"] = downloaded
                                
                                # Update progress and speed
                                current_time = time.time()
                                if task["total_size"] > 0:
                                    task["progress"] = (downloaded / task["total_size"]) * 100
                                
                                # Calculate speed and ETA every few chunks
                                time_diff = current_time - last_time
                                if time_diff >= 2.0:  # Update every 2 seconds
                                    bytes_diff = downloaded - last_downloaded
                                    task["speed"] = bytes_diff / time_diff  # bytes per second
                                    
                                    if task["speed"] > 0 and task["total_size"] > 0:
                                        remaining_bytes = task["total_size"] - downloaded
                                        task["eta"] = remaining_bytes / task["speed"]
                                    
                                    # Progress logging
                                    progress_mb = downloaded / (1024 * 1024)
                                    total_mb = task["total_size"] / (1024 * 1024) if task["total_size"] > 0 else 0
                                    speed_mbps = task["speed"] / (1024 * 1024) if task["speed"] > 0 else 0
                                    
                                    if total_mb > 0:
                                        print(f"📥 {task['filename']}: {progress_mb:.1f}/{total_mb:.1f} MB ({task['progress']:.1f}%) - {speed_mbps:.2f} MB/s")
                                    else:
                                        print(f"📥 {task['filename']}: {progress_mb:.1f} MB - {speed_mbps:.2f} MB/s")
                                    
                                    last_time = current_time
                                    last_downloaded = downloaded
                
                # Download completed successfully
                break
                
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
                retry_count += 1
                task["retry_count"] = retry_count
                
                if retry_count <= max_retries:
                    wait_time = min(2 ** retry_count, 30)  # Exponential backoff, max 30s
                    print(f"⚠️ Download error (attempt {retry_count}/{max_retries}): {str(e)}")
                    print(f"🔄 Retrying in {wait_time}s...")
                    
                    task["status"] = "retrying"
                    task["error"] = f"Retry {retry_count}/{max_retries}: {str(e)}"
                    await asyncio.sleep(wait_time)
                    
                    # Update downloaded size for next attempt
                    downloaded = await get_downloaded_size(temp_path)
                    task["downloaded_size"] = downloaded
                else:
                    # Max retries exceeded
                    print(f"❌ Max retries exceeded for {task['filename']}")
                    raise e
        
        # Move temp file to final location
        if os.path.exists(temp_path):
            if os.path.exists(task["target_path"]):
                os.remove(task["target_path"])  # Remove existing file if overwriting
            os.rename(temp_path, task["target_path"])

            # Verify file size
            final_size = os.path.getsize(task["target_path"])
            print(f"✅ Download completed: {task['filename']} ({final_size:,} bytes)")

            # Check if file is a ZIP and extract it
            if task["filename"].lower().endswith('.zip'):
                try:
                    print(f"📦 Extracting ZIP file: {task['filename']}")
                    import zipfile

                    # Get target directory (parent of the zip file)
                    target_dir = os.path.dirname(task["target_path"])

                    # Extract ZIP contents
                    with zipfile.ZipFile(task["target_path"], 'r') as zip_ref:
                        zip_ref.extractall(target_dir)

                    print(f"✅ ZIP extraction completed: {task['filename']}")

                    # Remove the ZIP file after successful extraction
                    os.remove(task["target_path"])
                    print(f"🗑️ Removed ZIP file: {task['filename']}")

                except zipfile.BadZipFile:
                    print(f"⚠️ File is not a valid ZIP archive: {task['filename']}")
                except Exception as e:
                    print(f"⚠️ Failed to extract ZIP file: {task['filename']} - {str(e)}")

        task["status"] = "completed"
        task["completed_at"] = time.time()
        task["progress"] = 100
        
    except Exception as e:
        task["status"] = "error"
        task["error"] = str(e)
        print(f"❌ Download failed: {task['filename']} - {str(e)}")
        
        # Don't clean up temp file on error - keep for potential resume
        print(f"💾 Partial file preserved for resume: {temp_path}")
        
        # Log partial download info
        partial_size = await get_downloaded_size(temp_path)
        if partial_size > 0:
            partial_mb = partial_size / (1024 * 1024)
            print(f"📊 Partial download: {partial_mb:.1f} MB saved")

async def cancel_download(request):
    """Cancel a running download task"""
    global download_tasks
    
    try:
        task_id = request.match_info['task_id']
        
        if task_id not in download_tasks:
            return web.json_response({
                "success": False,
                "error": f"Download task not found: {task_id}"
            }, status=404)
        
        task = download_tasks[task_id]
        
        # Check if task can be cancelled
        if task["status"] in ["completed", "error", "cancelled"]:
            return web.json_response({
                "success": False,
                "error": f"Cannot cancel task with status: {task['status']}"
            }, status=400)
        
        # Mark task as cancelled
        task["cancelled"] = True
        task["status"] = "cancelled"
        task["completed_at"] = time.time()
        
        # Clean up partial download file if it exists
        temp_path = task["target_path"] + ".downloading"
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception as e:
            # Log the error but don't fail the cancellation
            print(f"Warning: Could not clean up temp file {temp_path}: {str(e)}")
        
        return web.json_response({
            "success": True,
            "message": f"Download task {task_id} cancelled successfully",
            "task_info": {
                "task_id": task_id,
                "status": task["status"],
                "filename": task["filename"],
                "target_folder": task["target_folder"]
            }
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to cancel download: {str(e)}"
        }, status=500)

async def list_downloads(request):
    """Get status of all download tasks"""
    global download_tasks
    
    try:
        # Optional filters
        status_filter = request.query.get('status')  # e.g., ?status=downloading
        limit = request.query.get('limit', '50')  # Default to 50 most recent
        
        try:
            limit = int(limit)
            if limit <= 0:
                limit = 50
        except ValueError:
            limit = 50
        
        # Get all tasks, sorted by creation time (newest first)
        all_tasks = list(download_tasks.values())
        all_tasks.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Apply status filter if specified
        if status_filter:
            all_tasks = [task for task in all_tasks if task["status"] == status_filter]
        
        # Apply limit
        tasks = all_tasks[:limit]
        
        # Clean up task info for response (remove sensitive data like full paths)
        clean_tasks = []
        for task in tasks:
            clean_task = {
                "id": task["id"],
                "filename": task["filename"],
                "target_folder": task["target_folder"],
                "status": task["status"],
                "progress": task["progress"],
                "total_size": task["total_size"],
                "downloaded_size": task["downloaded_size"],
                "speed": task["speed"],
                "eta": task["eta"],
                "created_at": task["created_at"],
                "started_at": task["started_at"],
                "completed_at": task["completed_at"],
                "error": task["error"],
                "supports_resume": task.get("supports_resume", False),
                "retry_count": task.get("retry_count", 0),
                "max_retries": task.get("max_retries", 3),
                "can_resume": task["status"] in ["error", "cancelled"] and task.get("downloaded_size", 0) > 0
            }
            clean_tasks.append(clean_task)
        
        # Calculate summary statistics
        summary = {
            "total_tasks": len(all_tasks),
            "returned_tasks": len(clean_tasks),
            "by_status": {}
        }
        
        # Count tasks by status
        for task in all_tasks:
            status = task["status"]
            summary["by_status"][status] = summary["by_status"].get(status, 0) + 1
        
        return web.json_response({
            "success": True,
            "downloads": clean_tasks,
            "summary": summary
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to list downloads: {str(e)}"
        }, status=500)

async def clear_download_history(request):
    """Clear all download history/tasks"""
    global download_tasks
    
    try:
        # Count tasks before clearing
        total_before = len(download_tasks)
        
        # Optional: Only clear completed/error/cancelled tasks (keep active ones)
        preserve_active = request.query.get('preserve_active', 'false').lower() == 'true'
        
        if preserve_active:
            # Keep only actively downloading tasks
            active_statuses = ['starting', 'downloading']
            active_tasks = {
                task_id: task for task_id, task in download_tasks.items() 
                if task["status"] in active_statuses
            }
            cleared_count = total_before - len(active_tasks)
            download_tasks = active_tasks
        else:
            # Clear all tasks
            cleared_count = total_before
            download_tasks.clear()
        
        return web.json_response({
            "success": True,
            "message": f"Download history cleared successfully",
            "cleared_count": cleared_count,
            "remaining_tasks": len(download_tasks)
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to clear download history: {str(e)}"
        }, status=500)

