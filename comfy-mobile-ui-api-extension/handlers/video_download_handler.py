import os
import json
import time
import asyncio
import subprocess
import sys
from typing import Dict, Any, Optional
from aiohttp import web
import folder_paths
from ..utils.download_video import download_video_async
from ..utils.video_thumbnail import generate_video_thumbnail_async

async def download_youtube_video(request):
    """Download a YouTube video to the ComfyUI input directory"""
    try:
        data = await request.json()

        # Validate required parameters
        if 'url' not in data:
            return web.json_response({
                "success": False,
                "error": "Missing required field: url"
            }, status=400)

        url = data['url']
        filename = data.get('filename')  # Optional custom filename
        subfolder = data.get('subfolder', '')  # Optional subfolder within input directory

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

        # Get ComfyUI input directory
        input_path = folder_paths.get_input_directory()

        # Build target directory path
        if subfolder:
            target_dir = os.path.join(input_path, subfolder)
        else:
            target_dir = input_path

        # Ensure target directory exists
        os.makedirs(target_dir, exist_ok=True)

        print(f"🎥 Starting YouTube video download: {url}")
        print(f"📁 Target directory: {target_dir}")

        # Progress callback to send logs to ComfyUI backend
        async def progress_callback(message):
            # Simply print to send to ComfyUI's log interceptor
            print(message)

        # Download video using the async function
        result = await download_video_async(url, target_dir, filename, progress_callback)

        if result["success"]:
            # Wait a brief moment for file system to fully complete the merge process
            await asyncio.sleep(1)
            downloaded_file = result.get("downloaded_file")
            video_path = None
            thumbnail_info = None

            # Try to find the actual video file path
            if downloaded_file:
                video_path = os.path.join(target_dir, downloaded_file)
                print(f"🔍 Looking for video file: {video_path}")

                if os.path.exists(video_path):
                    print(f"✅ Found video file at expected path: {video_path}")
                else:
                    print(f"❌ Video file not found at expected path: {video_path}")
                    # Try without directory if it's already a full path
                    if os.path.exists(downloaded_file):
                        video_path = downloaded_file
                        print(f"✅ Found video file as full path: {video_path}")
                    else:
                        print(f"🔍 Searching for video files in directory: {target_dir}")
                        # Search for the most recently modified video file in the directory
                        video_files = [f for f in os.listdir(target_dir)
                                     if f.endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm'))]

                        if video_files:
                            # Sort by modification time, most recent first
                            video_files.sort(key=lambda x: os.path.getmtime(os.path.join(target_dir, x)), reverse=True)
                            downloaded_file = video_files[0]  # Get most recent
                            video_path = os.path.join(target_dir, downloaded_file)
                            print(f"✅ Found most recent video file: {downloaded_file}")
                        else:
                            video_path = None
                            print(f"❌ No video files found in directory")
            else:
                print(f"⚠️ No downloaded_file returned from download_video_async, searching directory...")
                # If no filename was returned, search for most recent video file
                try:
                    video_files = [f for f in os.listdir(target_dir)
                                 if f.endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm'))]

                    if video_files:
                        # Sort by modification time, most recent first
                        video_files.sort(key=lambda x: os.path.getmtime(os.path.join(target_dir, x)), reverse=True)
                        downloaded_file = video_files[0]  # Get most recent
                        video_path = os.path.join(target_dir, downloaded_file)
                        print(f"✅ Found most recent video file: {downloaded_file}")
                    else:
                        video_path = None
                        print(f"❌ No video files found in directory")
                except Exception as e:
                    video_path = None
                    print(f"❌ Error searching directory: {e}")

            # Generate thumbnail if video file was found
            if video_path and os.path.exists(video_path):
                # Ensure file is fully accessible (not still being written)
                file_ready = False
                max_retries = 5

                for retry in range(max_retries):
                    try:
                        # Try to open the file to ensure it's not locked
                        with open(video_path, 'rb') as f:
                            # Just read a small amount to test accessibility
                            f.read(1024)
                        file_ready = True
                        break
                    except (IOError, OSError) as e:
                        print(f"⏳ File not ready yet (attempt {retry + 1}/{max_retries}): {e}")
                        await asyncio.sleep(0.5)

                if not file_ready:
                    print(f"⚠️ File still not accessible after {max_retries} attempts: {video_path}")
                else:
                    try:
                        print(f"📸 Generating thumbnail for: {video_path}")
                        thumbnail_result = await generate_video_thumbnail_async(
                            video_path,
                            max_width=800,
                            max_height=600,
                            seek_time=1.0
                        )

                        if thumbnail_result["success"]:
                            thumbnail_info = {
                                "thumbnail_path": thumbnail_result["thumbnail_path"],
                                "file_size": thumbnail_result["file_size"]
                            }
                            print(f"✅ Thumbnail generated: {thumbnail_result['thumbnail_path']}")
                        else:
                            print(f"⚠️ Thumbnail generation failed: {thumbnail_result.get('error', 'Unknown error')}")

                    except Exception as thumbnail_error:
                        print(f"⚠️ Thumbnail generation error: {str(thumbnail_error)}")
            else:
                print(f"⚠️ Could not find video file for thumbnail generation: {video_path}")

            response_data = {
                "success": True,
                "message": "Video downloaded successfully",
                "download_info": {
                    "url": url,
                    "target_directory": target_dir,
                    "subfolder": subfolder,
                    "downloaded_file": downloaded_file,
                    "custom_filename": filename,
                    "video_path": video_path
                }
            }

            # Add thumbnail info if generated
            if thumbnail_info:
                response_data["download_info"]["thumbnail"] = thumbnail_info

            # Add stdout info if available
            if result.get("stdout"):
                response_data["download_info"]["details"] = result["stdout"]

            print(f"✅ Video download completed: {downloaded_file}")
            return web.json_response(response_data)
        else:
            print(f"❌ Video download failed: {result.get('error', 'Unknown error')}")
            return web.json_response({
                "success": False,
                "error": result.get("error", "Download failed"),
                "message": result.get("message", "Video download failed")
            }, status=500)

    except json.JSONDecodeError as e:
        return web.json_response({
            "success": False,
            "error": f"Invalid JSON in request: {str(e)}"
        }, status=400)
    except Exception as e:
        print(f"❌ Unexpected error in video download: {str(e)}")
        return web.json_response({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }, status=500)

async def get_video_download_status(request):
    """Get the status of video download functionality"""
    try:
        # Check if yt-dlp is available
        import subprocess
        try:
            result = subprocess.run([sys.executable, '-m', 'yt_dlp', '--version'],
                                  capture_output=True, text=True, check=True)
            yt_dlp_version = result.stdout.strip()
            yt_dlp_available = True
        except (subprocess.CalledProcessError, FileNotFoundError):
            yt_dlp_version = None
            yt_dlp_available = False

        # Check if FFmpeg is available for thumbnail generation
        try:
            result = subprocess.run(['ffmpeg', '-version'],
                                  capture_output=True, text=True, check=True)
            # Extract version from first line
            ffmpeg_version = result.stdout.split('\n')[0] if result.stdout else "Available"
            ffmpeg_available = True
        except (subprocess.CalledProcessError, FileNotFoundError):
            ffmpeg_version = None
            ffmpeg_available = False

        # Get input directory info
        input_path = folder_paths.get_input_directory()
        input_writable = os.access(input_path, os.W_OK)

        return web.json_response({
            "success": True,
            "status": {
                "yt_dlp_available": yt_dlp_available,
                "yt_dlp_version": yt_dlp_version,
                "ffmpeg_available": ffmpeg_available,
                "ffmpeg_version": ffmpeg_version,
                "thumbnail_generation_available": ffmpeg_available,
                "input_directory": input_path,
                "input_writable": input_writable,
                "supported_sites": [
                    "YouTube", "TikTok", "Instagram", "Twitch",
                    "Twitter/X", "Facebook", "Vimeo", "Dailymotion",
                    "And 1000+ more sites"
                ]
            }
        })

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to get video download status: {str(e)}"
        }, status=500)

async def subscribe_to_logs(request):
    """Subscribe to ComfyUI logs (can be called multiple times safely)"""
    try:
        data = await request.json()
        client_id = data.get('clientId', 'comfy-mobile-ui-client-2025')

        # Get the current ComfyUI port dynamically
        from ..comfyui_detector import detect_comfyui_port
        comfyui_port = detect_comfyui_port()

        import aiohttp
        url = f"http://127.0.0.1:{comfyui_port}/internal/logs/subscribe"

        async with aiohttp.ClientSession() as session:
            async with session.patch(
                url,
                json={"enabled": True, "clientId": client_id},
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    return web.json_response({
                        "success": True,
                        "message": "Successfully subscribed to logs",
                        "clientId": client_id
                    })
                else:
                    error_text = await response.text()
                    return web.json_response({
                        "success": False,
                        "error": f"Failed to subscribe: HTTP {response.status}",
                        "details": error_text
                    }, status=response.status)

    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to subscribe to logs: {str(e)}"
        }, status=500)

async def upgrade_yt_dlp(request):
    """Upgrade yt-dlp to the latest version"""
    try:
        print("🔄 Starting yt-dlp upgrade...")

        # Execute pip upgrade command asynchronously
        process = await asyncio.create_subprocess_exec(
            sys.executable, '-m', 'pip', 'install', '--upgrade', 'yt-dlp',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode == 0:
            stdout_text = stdout.decode('utf-8') if stdout else ""
            print(f"✅ yt-dlp upgrade completed successfully!")
            print(f"Output: {stdout_text}")

            # Get the new version after upgrade
            try:
                version_process = await asyncio.create_subprocess_exec(
                    sys.executable, '-m', 'yt_dlp', '--version',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                version_stdout, _ = await version_process.communicate()
                new_version = version_stdout.decode('utf-8').strip() if version_stdout else "Unknown"
            except:
                new_version = "Unknown"

            return web.json_response({
                "success": True,
                "message": "yt-dlp upgraded successfully",
                "new_version": new_version,
                "upgrade_output": stdout_text
            })
        else:
            stderr_text = stderr.decode('utf-8') if stderr else "Unknown error"
            print(f"❌ yt-dlp upgrade failed: {stderr_text}")

            return web.json_response({
                "success": False,
                "error": f"Upgrade failed: {stderr_text}",
                "message": "Failed to upgrade yt-dlp"
            }, status=500)

    except FileNotFoundError:
        error_msg = "Python executable not found. Please ensure Python is properly installed."
        print(f"❌ {error_msg}")
        return web.json_response({
            "success": False,
            "error": error_msg,
            "message": "pip not available"
        }, status=500)
    except Exception as e:
        error_msg = f"Unexpected error during yt-dlp upgrade: {str(e)}"
        print(f"❌ {error_msg}")
        return web.json_response({
            "success": False,
            "error": error_msg,
            "message": "Upgrade failed due to unexpected error"
        }, status=500)