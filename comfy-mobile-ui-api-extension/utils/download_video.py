#!/usr/bin/env python3
import sys
import os
import subprocess
import argparse
import asyncio
import folder_paths
from typing import Dict, Any, Optional

async def download_video_async(url: str, output_dir: Optional[str] = None, filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Downloads videos from various sites to MP4 format asynchronously.
    (Supports 1000+ sites including YouTube, TikTok, Instagram, Twitch)

    Args:
        url (str): Video URL to download
        output_dir (str, optional): Output directory. Defaults to ComfyUI input directory
        filename (str, optional): Custom filename (without extension)

    Returns:
        Dict[str, Any]: Result dictionary with success status and details
    """
    try:
        # Use ComfyUI input directory if not specified
        if output_dir is None:
            output_dir = folder_paths.get_input_directory()

        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        # Build output filename pattern
        if filename:
            output_pattern = f"{output_dir}/{filename}.%(ext)s"
        else:
            output_pattern = f"{output_dir}/%(title)s.%(ext)s"

        # Build yt-dlp command with iOS-compatible codec settings
        cmd = [
            "yt-dlp",
            # Use iOS-compatible format selection
            "-f", "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080][vcodec^=h264]+bestaudio[acodec^=aac]/best[height<=1080]",
            "--merge-output-format", "mp4",  # Merge to MP4
            # Force H.264 video codec and AAC audio (iOS compatible)
            "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
            # Optimize for mobile playback
            "--embed-metadata",
            "-o", output_pattern,  # Output filename pattern
            url
        ]

        print(f"Starting video download: {url}")
        print(f"Output directory: {os.path.abspath(output_dir)}")

        # Execute yt-dlp asynchronously
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode == 0:
            stdout_text = stdout.decode('utf-8') if stdout else ""
            print("Video download completed successfully!")
            if stdout_text:
                print(stdout_text)

            # Try to extract the actual downloaded filename from stdout
            downloaded_file = None

            # First, try to find merged file from [Merger] line (most accurate for final file)
            for line in stdout_text.split('\n'):
                if '[Merger] Merging formats into' in line:
                    # Extract filename from merger line: [Merger] Merging formats into "path/file.mp4"
                    if '"' in line:
                        full_path = line.split('"')[1]  # Get path between quotes
                        downloaded_file = os.path.basename(full_path)  # Extract just filename
                        print(f"📁 Found merged file: {downloaded_file}")
                        break

            # If no merger line found, look for final .mp4 destination (skip temporary files)
            if not downloaded_file:
                for line in stdout_text.split('\n'):
                    if 'Destination:' in line and not line.endswith(('.f135.mp4', '.f140.m4a', '.f136.mp4', '.f251.webm')):
                        # Skip temporary format files, only get final merged files
                        full_path = line.split('Destination:')[-1].strip()
                        if full_path.endswith('.mp4'):
                            downloaded_file = os.path.basename(full_path)
                            print(f"📁 Found destination file: {downloaded_file}")
                            break

            # Fallback: look for already downloaded files
            if not downloaded_file:
                for line in stdout_text.split('\n'):
                    if '[download]' in line and 'has already been downloaded' in line:
                        downloaded_file = line.split('\\')[-1].split('/')[-1].split(' has already been downloaded')[0]
                        print(f"📁 Found existing file: {downloaded_file}")
                        break

            return {
                "success": True,
                "message": "Video downloaded successfully",
                "output_dir": output_dir,
                "downloaded_file": downloaded_file,
                "stdout": stdout_text
            }
        else:
            stderr_text = stderr.decode('utf-8') if stderr else "Unknown error"
            print(f"Video download failed: {stderr_text}")
            return {
                "success": False,
                "error": stderr_text,
                "message": "Video download failed"
            }

    except FileNotFoundError:
        error_msg = "yt-dlp is not installed. Install it with: pip install yt-dlp"
        print(error_msg)
        return {
            "success": False,
            "error": error_msg,
            "message": "yt-dlp not found"
        }
    except Exception as e:
        error_msg = f"Unexpected error during video download: {str(e)}"
        print(error_msg)
        return {
            "success": False,
            "error": error_msg,
            "message": "Unexpected error occurred"
        }

def download_video(url, output_dir="."):
    """
    Synchronous wrapper for backward compatibility.
    Downloads videos from various sites to MP4 format.
    (Supports 1000+ sites including YouTube, TikTok, Instagram, Twitch)

    Args:
        url (str): Video URL to download
        output_dir (str): Output directory (default: current directory)
    """
    try:
        # Build yt-dlp command with iOS-compatible codec settings
        cmd = [
            "yt-dlp",
            # Use iOS-compatible format selection
            "-f", "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080][vcodec^=h264]+bestaudio[acodec^=aac]/best[height<=1080]",
            "--merge-output-format", "mp4",  # Merge to MP4
            # Force H.264 video codec and AAC audio (iOS compatible)
            "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
            # Optimize for mobile playback
            "--embed-metadata",
            "-o", f"{output_dir}/%(title)s.%(ext)s",  # Output filename pattern
            url
        ]

        print(f"Starting download: {url}")
        print(f"Save path: {os.path.abspath(output_dir)}")

        # Execute yt-dlp
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)

        print("Download completed!")
        if result.stdout:
            print(result.stdout)

    except subprocess.CalledProcessError as e:
        print(f"Download failed: {e}")
        if e.stderr:
            print(f"Error message: {e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print("yt-dlp is not installed.")
        print("Install with: pip install yt-dlp")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Download videos from various sites to MP4 format")
    parser.add_argument("url", help="Video URL (YouTube, TikTok, Instagram, Twitch, etc.)")
    parser.add_argument("-o", "--output", default=".", help="Output directory (default: current directory)")

    args = parser.parse_args()

    # Validate URL format (check for HTTP/HTTPS protocol)
    if not (args.url.startswith("http://") or args.url.startswith("https://")):
        print("Please enter a valid URL (starting with http:// or https://)")
        sys.exit(1)

    # Create output directory if it doesn't exist
    if not os.path.exists(args.output):
        os.makedirs(args.output)

    download_video(args.url, args.output)

if __name__ == "__main__":
    main()