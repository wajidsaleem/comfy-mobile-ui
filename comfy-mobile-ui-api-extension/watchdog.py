# ComfyUI Mobile UI API Extension - Watchdog Service
# Provides self-restart capability for ComfyUI

import subprocess
import threading
import time
import os
import sys
import signal
import json
import psutil
from typing import Optional
from pathlib import Path

class ComfyUIWatchdog:
    """
    External watchdog process manager (internal watchdog removal)
    """
    
    def __init__(self, comfyui_path: str = None, comfyui_port: int = 8188, comfyui_script: str = "main.py"):
        # External watchdog process related
        self.external_watchdog_process: Optional[subprocess.Popen] = None
        self.watchdog_script_path = Path(__file__).parent / "external_watchdog.py"
        self.watchdog_port = 9188  # Watchdog API port (fixed)
        
        # ComfyUI related settings (may vary per user)
        self.comfyui_path = comfyui_path or os.getcwd()  # ComfyUI installation path
        self.comfyui_port = comfyui_port  # ComfyUI server port
        self.comfyui_script = comfyui_script  # ComfyUI main script
        
        # ComfyUI original launch args file
        self.original_args_file = Path(__file__).parent / "comfyui_original_args.json"
        
        # Save ComfyUI original launch args (once per watchdog start)
        self._save_original_comfyui_args()
    
    def _save_original_comfyui_args(self):
        """Save ComfyUI original launch args (once per watchdog start)"""
        try:
            # Extract ComfyUI launch args from current environment
            from .comfyui_detector import get_comfyui_launch_args
            original_args = get_comfyui_launch_args()
            
            # Save launch args (overwrite each time)
            import json
            with open(self.original_args_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'args': original_args,
                    'saved_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'comfyui_script': self.comfyui_script,
                    'comfyui_port': self.comfyui_port
                }, f, indent=2)
            
            print(f"[SUCCESS] ComfyUI current launch args saved (overwrite): {original_args}")
            
        except Exception as e:
            print(f"[ERROR] Failed to save ComfyUI launch args: {e}")
            raise
    
    def _get_original_comfyui_args(self) -> list:
        """Return saved ComfyUI original launch args"""
        try:
            if self.original_args_file.exists():
                import json
                with open(self.original_args_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    args = data.get('args', [])
                    print(f"📋 Using saved ComfyUI original launch args: {args}")
                    return args
            else:
                print(f"⚠️ No saved launch args file, using default args")
                return []
        except Exception as e:
            print(f"❌ Failed to load saved launch args: {e}, using default args")
            return []
        
    def start_watchdog(self) -> bool:
        """
        Start external watchdog process
        
        Returns:
            bool: Start success status
        """
        return self.start_external_watchdog()
    
    def start_external_watchdog(self) -> bool:
        """Start external watchdog process"""
        try:
            if not self.watchdog_script_path.exists():
                print(f"❌ External watchdog script not found: {self.watchdog_script_path}")
                return False
            
            # Check if watchdog is already running
            try:
                import requests
                response = requests.get(f"http://localhost:{self.watchdog_port}/", timeout=3)
                if response.status_code == 200:
                    print(f"[WARN] External watchdog already running on port {self.watchdog_port}")
                    return True  # Already running, treat as success
            except:
                pass  # Not running, continue
            
            # Use original ComfyUI launch args (saved or default)
            # Watchdog must preserve ComfyUI's original launch args
            launch_args = self._get_original_comfyui_args()
            
            # Combine main script and launch args
            full_args = [self.comfyui_script] + launch_args
            
            # Start external watchdog process (JSON file is already created)
            cmd = [
                sys.executable,
                str(self.watchdog_script_path),
                '--api-port', str(self.watchdog_port)  # 9188 directly passed
            ]
            
            print(f"[START] Starting external watchdog: {' '.join(cmd)}")
            
            # Start as independent process group with visible terminal
            if os.name == 'nt':  # Windows
                # Create independent process group with visible terminal
                creation_flags = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP
                
                self.external_watchdog_process = subprocess.Popen(
                    cmd,
                    creationflags=creation_flags,
                    # Do not redirect stdout/stderr to new terminal window
                )
            else:  # Unix/Linux/Mac
                # Create independent process group with visible terminal
                self.external_watchdog_process = subprocess.Popen(
                    cmd,
                    preexec_fn=os.setsid,  # Create new session for complete independence
                    # Run in background on current terminal while showing output
                )
            
            watchdog_pid = self.external_watchdog_process.pid
            print(f"✅ External watchdog started (PID: {watchdog_pid})")
            
            # Detach process for complete independence
            # Prevent watchdog from being affected by parent process termination
            self.external_watchdog_process = None
            
            # Only log PID and do not maintain reference
            print(f"🔄 Watchdog process detached for complete independence (PID: {watchdog_pid})")
            return True
            
        except Exception as e:
            print(f"❌ Failed to start external watchdog: {e}")
            return False
    
    def stop_external_watchdog(self) -> bool:
        """Stop external watchdog process (API-based)"""
        try:
            print("🛑 Requesting external watchdog shutdown...")
            
            # API to gracefully request shutdown
            import requests
            try:
                response = requests.post(f"http://localhost:{self.watchdog_port}/shutdown", timeout=5)
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ Watchdog shutdown requested: {result.get('message', 'Success')}")
                    return True
                else:
                    print(f"⚠️ Watchdog shutdown request failed: {response.status_code}")
            except Exception as api_error:
                print(f"⚠️ Could not request graceful shutdown: {api_error}")
            
            # API method failed but watchdog is independent, so treat as success
            # (watchdog is already independent, so parent process has no control)
            print("ℹ️ Watchdog is independent - will continue running until explicitly stopped")
            return True
            
        except Exception as e:
            print(f"❌ Error stopping external watchdog: {e}")
            return False
    
    def stop_watchdog(self):
        """Stop watchdog service"""
        return self.stop_external_watchdog()
    
    def request_restart(self) -> bool:
        """
        Request restart through external watchdog
        
        Returns:
            bool: Request success status
        """
        try:
            import requests
            response = requests.post(f"http://localhost:{self.watchdog_port}/restart", timeout=10)
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Watchdog restart requested: {result.get('message', 'Success')}")
                return result.get('success', False)
            else:
                print(f"❌ Watchdog API response error: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Watchdog API communication error: {e}")
            return False
    
    def get_status(self) -> dict:
        """
        Get external watchdog status
        
        Returns:
            dict: Status information
        """
        # API to get detailed status (independent watchdog, so use API only)
        api_status = None
        process_status = {
            "running": False,
            "pid": None
        }
        
        try:
            import requests
            response = requests.get(f"http://localhost:{self.watchdog_port}/status", timeout=5)
            if response.status_code == 200:
                api_status = response.json()
                # API response indicates watchdog is running
                process_status["running"] = True
                # Use PID from API response if available
                if api_status and isinstance(api_status, dict):
                    process_status["pid"] = api_status.get("pid")
        except Exception as e:
            print(f"⚠️ Watchdog API status query failed: {e}")
        
        return {
            "process": process_status,
            "api_port": self.watchdog_port,
            "api_status": api_status
        }

# Global watchdog instance
_watchdog_instance: Optional[ComfyUIWatchdog] = None

def get_watchdog(comfyui_path: str = None, comfyui_port: int = 8188, comfyui_script: str = "main.py") -> ComfyUIWatchdog:
    """
    Return watchdog singleton instance
    
    Args:
        comfyui_path: ComfyUI installation path
        comfyui_port: ComfyUI server port
        comfyui_script: ComfyUI main script filename
        
    Returns:
        ComfyUIWatchdog: Watchdog instance
    """
    global _watchdog_instance
    if _watchdog_instance is None:
        _watchdog_instance = ComfyUIWatchdog(comfyui_path, comfyui_port, comfyui_script)
    return _watchdog_instance

def initialize_watchdog(comfyui_path: str = None, comfyui_port: int = None, comfyui_script: str = None) -> bool:
    """
    Initialize and start watchdog (auto-detection support)
    
    Args:
        comfyui_path: ComfyUI installation path (None for auto-detection)
        comfyui_port: ComfyUI server port (None for auto-detection)
        comfyui_script: ComfyUI main script filename (None for auto-detection)
        
    Returns:
        bool: Initialization success status
    """
    try:
        # Parameters not specified, auto-detect
        if comfyui_path is None or comfyui_port is None or comfyui_script is None:
            from .comfyui_detector import detect_comfyui_environment
            detected_path, detected_port, detected_script = detect_comfyui_environment()
            
            # Use auto-detect values for unspecified parameters
            comfyui_path = comfyui_path or detected_path
            comfyui_port = comfyui_port or detected_port
            comfyui_script = comfyui_script or detected_script
        
        watchdog = get_watchdog(comfyui_path, comfyui_port, comfyui_script)
        return watchdog.start_watchdog()
    except Exception as e:
        print(f"[ERROR] Watchdog initialization failed: {e}")
        return False

def shutdown_watchdog():
    """Stop watchdog service"""
    global _watchdog_instance
    if _watchdog_instance:
        _watchdog_instance.stop_watchdog()
        _watchdog_instance = None