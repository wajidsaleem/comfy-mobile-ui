#!/usr/bin/env python3
import os
import subprocess
import asyncio
from typing import Optional, Dict, Any

async def generate_video_thumbnail_async(
    video_path: str,
    thumbnail_path: Optional[str] = None,
    max_width: int = 800,
    max_height: int = 600,
    seek_time: float = 1.0
) -> Dict[str, Any]:
    """
    Generate thumbnail from video first frame using FFmpeg while preserving aspect ratio.

    Args:
        video_path (str): Path to the input video file
        thumbnail_path (str, optional): Output thumbnail path. If None, generates based on video filename
        max_width (int): Maximum thumbnail width (default: 800)
        max_height (int): Maximum thumbnail height (default: 600)
        seek_time (float): Time in seconds to extract frame from (default: 1.0)

    Returns:
        Dict[str, Any]: Result dictionary with success status and details
    """
    try:
        # Validate input file exists
        if not os.path.exists(video_path):
            return {
                "success": False,
                "error": f"Video file not found: {video_path}",
                "message": "Input video file does not exist"
            }

        # Generate thumbnail path if not provided
        if thumbnail_path is None:
            video_dir = os.path.dirname(video_path)
            video_name = os.path.basename(video_path)
            name_without_ext = os.path.splitext(video_name)[0]
            thumbnail_path = os.path.join(video_dir, f"{name_without_ext}.png")

        # Ensure output directory exists
        thumbnail_dir = os.path.dirname(thumbnail_path)
        os.makedirs(thumbnail_dir, exist_ok=True)

        print(f"🎬 Generating thumbnail for: {video_path}")
        print(f"📸 Output thumbnail: {thumbnail_path}")
        print(f"📐 Max dimensions: {max_width}x{max_height}")

        # Build FFmpeg command with aspect ratio preservation
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output file
            "-i", video_path,  # Input video
            "-ss", str(seek_time),  # Seek to specific time
            "-vframes", "1",  # Extract only 1 frame
            "-vf", f"scale='if(gt(iw,ih),min({max_width},iw),-1)':'if(gt(iw,ih),-1,min({max_height},ih))'",  # Scale preserving aspect ratio
            "-q:v", "2",  # High quality (1-31, lower is better)
            thumbnail_path
        ]

        # Execute FFmpeg asynchronously
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode == 0:
            if os.path.exists(thumbnail_path):
                # Get thumbnail file info
                stat_info = os.stat(thumbnail_path)
                file_size = stat_info.st_size

                print(f"✅ Thumbnail generated successfully!")
                print(f"📁 File size: {file_size / 1024:.1f} KB")

                return {
                    "success": True,
                    "message": "Thumbnail generated successfully",
                    "thumbnail_path": thumbnail_path,
                    "file_size": file_size,
                    "video_path": video_path,
                    "ffmpeg_output": stdout.decode('utf-8') if stdout else ""
                }
            else:
                return {
                    "success": False,
                    "error": "Thumbnail file was not created",
                    "message": "FFmpeg completed but thumbnail file is missing"
                }
        else:
            stderr_text = stderr.decode('utf-8') if stderr else "Unknown FFmpeg error"
            print(f"❌ FFmpeg failed: {stderr_text}")
            return {
                "success": False,
                "error": f"FFmpeg failed with code {process.returncode}: {stderr_text}",
                "message": "Failed to generate thumbnail"
            }

    except FileNotFoundError:
        error_msg = "FFmpeg is not installed or not found in PATH. Please install FFmpeg."
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "message": "FFmpeg not available"
        }
    except Exception as e:
        error_msg = f"Unexpected error during thumbnail generation: {str(e)}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "message": "Unexpected error occurred"
        }

def generate_video_thumbnail(
    video_path: str,
    thumbnail_path: Optional[str] = None,
    max_width: int = 800,
    max_height: int = 600,
    seek_time: float = 1.0
) -> Dict[str, Any]:
    """
    Synchronous wrapper for video thumbnail generation.

    Args:
        video_path (str): Path to the input video file
        thumbnail_path (str, optional): Output thumbnail path. If None, generates based on video filename
        max_width (int): Maximum thumbnail width (default: 800)
        max_height (int): Maximum thumbnail height (default: 600)
        seek_time (float): Time in seconds to extract frame from (default: 1.0)

    Returns:
        Dict[str, Any]: Result dictionary with success status and details
    """
    try:
        # Validate input file exists
        if not os.path.exists(video_path):
            return {
                "success": False,
                "error": f"Video file not found: {video_path}",
                "message": "Input video file does not exist"
            }

        # Generate thumbnail path if not provided
        if thumbnail_path is None:
            video_dir = os.path.dirname(video_path)
            video_name = os.path.basename(video_path)
            name_without_ext = os.path.splitext(video_name)[0]
            thumbnail_path = os.path.join(video_dir, f"{name_without_ext}.png")

        # Ensure output directory exists
        thumbnail_dir = os.path.dirname(thumbnail_path)
        os.makedirs(thumbnail_dir, exist_ok=True)

        print(f"🎬 Generating thumbnail for: {video_path}")
        print(f"📸 Output thumbnail: {thumbnail_path}")
        print(f"📐 Max dimensions: {max_width}x{max_height}")

        # Build FFmpeg command with aspect ratio preservation
        cmd = [
            "ffmpeg",
            "-y",  # Overwrite output file
            "-i", video_path,  # Input video
            "-ss", str(seek_time),  # Seek to specific time
            "-vframes", "1",  # Extract only 1 frame
            "-vf", f"scale='if(gt(iw,ih),min({max_width},iw),-1)':'if(gt(iw,ih),-1,min({max_height},ih))'",  # Scale preserving aspect ratio
            "-q:v", "2",  # High quality (1-31, lower is better)
            thumbnail_path
        ]

        # Execute FFmpeg
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)

        if result.returncode == 0:
            if os.path.exists(thumbnail_path):
                # Get thumbnail file info
                stat_info = os.stat(thumbnail_path)
                file_size = stat_info.st_size

                print(f"✅ Thumbnail generated successfully!")
                print(f"📁 File size: {file_size / 1024:.1f} KB")

                return {
                    "success": True,
                    "message": "Thumbnail generated successfully",
                    "thumbnail_path": thumbnail_path,
                    "file_size": file_size,
                    "video_path": video_path,
                    "ffmpeg_output": result.stdout
                }
            else:
                return {
                    "success": False,
                    "error": "Thumbnail file was not created",
                    "message": "FFmpeg completed but thumbnail file is missing"
                }
        else:
            print(f"❌ FFmpeg failed: {result.stderr}")
            return {
                "success": False,
                "error": f"FFmpeg failed with code {result.returncode}: {result.stderr}",
                "message": "Failed to generate thumbnail"
            }

    except FileNotFoundError:
        error_msg = "FFmpeg is not installed or not found in PATH. Please install FFmpeg."
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "message": "FFmpeg not available"
        }
    except Exception as e:
        error_msg = f"Unexpected error during thumbnail generation: {str(e)}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "message": "Unexpected error occurred"
        }