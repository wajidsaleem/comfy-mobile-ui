#!/usr/bin/env python3
"""
Enhanced ComfyUI External Watchdog with API Server
Provides an API server for external access
"""

import os
import sys
import time
import subprocess
import psutil
import requests
import signal
import json
import argparse
import threading
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

# Simple HTTP server (minimal external dependencies)
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import socketserver


class WatchdogAPIHandler(BaseHTTPRequestHandler):
    """Watchdog API request handler"""
    
    def do_GET(self):
        """GET request handler"""
        path = urlparse(self.path).path
        
        if path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "service": "ComfyUI External Watchdog API",
                "version": "1.0.0",
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif path == '/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Get status from watchdog instance
            status = self.server.watchdog.get_api_status()
            self.wfile.write(json.dumps(status).encode())
            
        elif path == '/logs':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Get recent logs
            logs = self.server.watchdog.get_recent_logs()
            self.wfile.write(json.dumps(logs).encode())
            
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
    
    def do_POST(self):
        """POST request handler"""
        path = urlparse(self.path).path
        content_length = int(self.headers.get('Content-Length', 0))
        
        if content_length > 0:
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode())
            except:
                data = {}
        else:
            data = {}
        
        if path == '/restart':
            # Manual restart request
            client_ip = self.client_address[0]
            user_agent = self.headers.get('User-Agent', 'Unknown')
            
            self.server.watchdog.log(f"Restart API called from {client_ip} (User-Agent: {user_agent})", 'api')
            
            try:
                result = self.server.watchdog.manual_restart()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    "success": result,
                    "message": "Restart sequence completed" if result else "Restart sequence failed",
                    "timestamp": datetime.now().isoformat(),
                    "details": "Check watchdog logs for detailed restart progress" if result else "Check watchdog logs for error details"
                }
                
                self.server.watchdog.log(f"Restart API response: {response['message']}", 'api')
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                self.server.watchdog.log(f"Exception in restart API handler: {e}", 'error')
                
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                error_response = {
                    "success": False,
                    "message": "Internal server error during restart",
                    "timestamp": datetime.now().isoformat(),
                    "error": str(e)
                }
                self.wfile.write(json.dumps(error_response).encode())
            
        elif path == '/config':
            # Configuration update
            result = self.server.watchdog.update_config(data)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "success": result,
                "message": "Config updated" if result else "Config update failed"
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif path == '/start':
            # Start watchdog with new configuration
            comfyui_path = data.get('comfyui_path')
            comfyui_port = data.get('comfyui_port', 8188)
            comfyui_script = data.get('comfyui_script', 'main.py')
            
            if comfyui_path:
                # Apply new configuration
                self.server.watchdog.comfyui_dir = comfyui_path
                self.server.watchdog.comfyui_port = comfyui_port
                self.server.watchdog.comfyui_args = [comfyui_script]
                
                result = True
                message = f"Watchdog configured for {comfyui_path}:{comfyui_port}/{comfyui_script}"
            else:
                result = False
                message = "ComfyUI path is required"
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "success": result,
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif path == '/shutdown':
            # Graceful shutdown request
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "success": True,
                "message": "Shutdown requested",
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())
            
            # Response after watchdog shutdown (in a separate thread)
            import threading
            def shutdown_watchdog():
                import time
                time.sleep(1)  # Ensure response is sent
                self.server.watchdog.log("[API] Shutdown requested via API")
                self.server.watchdog.shutdown()
            
            threading.Thread(target=shutdown_watchdog, daemon=True).start()
            
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
    
    def do_OPTIONS(self):
        """CORS preflight request handler"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress log messages (to prevent duplicate logging)"""
        pass


class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    """Multi-threaded HTTP server"""
    allow_reuse_address = True


class EnhancedExternalComfyUIWatchdog:
    """
    API server included enhanced external watchdog
    """
    
    def __init__(self, api_port: int):
        # Initialize log system first
        self.log_file = Path(__file__).parent / "watchdog.log"
        self.log_buffer = []
        self.max_log_buffer = 200
        self.log_stats = {
            'info': 0, 'warning': 0, 'error': 0, 'success': 0, 'debug': 0
        }
        
        # comfyui_original_args.json from ComfyUI settings load
        original_args_file = Path(__file__).parent / "comfyui_original_args.json"
        
        if not original_args_file.exists():
            self.log(f"ComfyUI original args file not found: {original_args_file}", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
        
        try:
            with open(original_args_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
        except Exception as e:
            self.log(f"Failed to load ComfyUI original args file: {e}", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
        
        # Check required fields
        if 'args' not in config_data:
            self.log("Missing 'args' field in ComfyUI original args file", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
            
        if 'comfyui_script' not in config_data:
            self.log("Missing 'comfyui_script' field in ComfyUI original args file", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
            
        if 'comfyui_port' not in config_data:
            self.log("Missing 'comfyui_port' field in ComfyUI original args file", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
        
        # ComfyUI settings extraction
        launch_args = config_data['args']
        comfyui_script = config_data['comfyui_script']
        self.comfyui_port = config_data['comfyui_port']
        self.comfyui_args = [comfyui_script] + launch_args
        
        # Use the Python executable that was originally used to start ComfyUI
        # This is stored in the first argument of sys.argv when ComfyUI was launched
        self.python_executable = sys.executable
        self.log(f"Using Python executable: {self.python_executable}", 'debug')
        
        # Use detector result - it already found the correct ComfyUI backend path
        try:
            # Add current directory to path for absolute import
            current_dir = Path(__file__).parent
            if str(current_dir) not in sys.path:
                sys.path.insert(0, str(current_dir))
            
            import comfyui_detector
            self.comfyui_dir = comfyui_detector.detect_comfyui_path()
            # Use the detector to find the correct Python executable
            detected_python = comfyui_detector.detect_python_executable()
            if detected_python != self.python_executable:
                self.log(f"Switching from {self.python_executable} to detected Python: {detected_python}", 'info')
                self.python_executable = detected_python
            self.log(f"Using ComfyUI backend directory from detector: {self.comfyui_dir}", 'info')
        except Exception as e:
            self.log(f"Failed to import detector: {e}", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
        
        # Check ComfyUI directory exists
        if not Path(self.comfyui_dir).exists():
            self.log(f"ComfyUI directory does not exist: {self.comfyui_dir}", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
            
        # Check main.py exists
        if not (Path(self.comfyui_dir) / comfyui_script).exists():
            self.log(f"ComfyUI script does not exist: {Path(self.comfyui_dir) / comfyui_script}", 'error')
            time.sleep(0.1)  # Ensure log is written
            sys.exit(1)
        
        self.check_interval = 30
        
        # API server configuration
        self.api_enabled = True
        self.api_port = api_port
        self.api_host = '0.0.0.0'
        
        # Runtime state
        self.comfyui_process: Optional[subprocess.Popen] = None
        self.is_running = True
        self.api_server: Optional[ThreadedHTTPServer] = None
        self.api_thread: Optional[threading.Thread] = None
        
        # Initialization complete
        self.log("Enhanced External Watchdog initialized", 'success')
        self.log(f"ComfyUI Directory: {self.comfyui_dir}", 'info')
        self.log(f"ComfyUI Port: {self.comfyui_port}", 'info')
        self.log(f"ComfyUI Args: {' '.join(self.comfyui_args)}", 'info')
        self.log(f"API Address: http://{self.api_host}:{self.api_port}", 'info')
        self.log(f"Check Interval: {self.check_interval}s", 'info')
    
    def log(self, message: str, level: str = 'info'):
        """Log message output and storage"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        iso_timestamp = datetime.now().isoformat()
        
        # Log level prefix
        level_prefixes = {
            'info': 'INFO',
            'warning': 'WARN',
            'error': 'ERROR',
            'success': 'SUCCESS',
            'debug': 'DEBUG',
            'api': 'API',
            'restart': 'RESTART'
        }
        
        level_prefix = level_prefixes.get(level, 'INFO')
        log_message = f"[{timestamp}] [{level_prefix}] {message}"
        print(log_message)
        
        # Update statistics
        if level in self.log_stats:
            self.log_stats[level] += 1
        else:
            self.log_stats['info'] += 1
        
        # Add to buffer (structured format)
        log_entry = {
            "timestamp": timestamp,
            "iso_timestamp": iso_timestamp,
            "level": level,
            "message": message,
            "full_message": log_message
        }
        self.log_buffer.append(log_entry)
        
        # Buffer size limit
        if len(self.log_buffer) > self.max_log_buffer:
            self.log_buffer.pop(0)
        
        # Save to file (continue even if failed)
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_message + '\n')
                f.flush() 
        except Exception as e:
            error_msg = f"[{timestamp}] [ERROR] Failed to write log: {e}"
            print(error_msg)
    
    def start_api_server(self) -> bool:
        """API server start"""
        if not self.api_enabled:
            return True
        
        try:
            bind_host = self.api_host
            if bind_host == '0.0.0.0':
                if os.name == 'nt':
                    bind_host = ''
            
            self.log(f"[API] Attempting to bind to {self.api_host}:{self.api_port}")
            
            self.api_server = ThreadedHTTPServer(
                (bind_host, self.api_port), 
                WatchdogAPIHandler
            )
            
            # Check binding address
            actual_host, actual_port = self.api_server.server_address
            if actual_host == '':
                actual_host = '0.0.0.0'
            
            self.api_server.watchdog = self
            
            self.api_thread = threading.Thread(
                target=self.api_server.serve_forever,
                daemon=True,
                name="WatchdogAPI"
            )
            self.api_thread.start()
            
            self.log(f"[API] API server successfully bound to {actual_host}:{actual_port}")
            return True
            
        except Exception as e:
            self.log(f"[ERROR] Failed to start API server: {e}")
            self.log(f"[DEBUG] Attempted bind address: {self.api_host}:{self.api_port}")
            return False
    
    def stop_api_server(self):
        """API server stop"""
        if self.api_server:
            self.log("[STOP] Stopping API server...")
            self.api_server.shutdown()
            self.api_server.server_close()
            
            if self.api_thread:
                self.api_thread.join(timeout=5)
            
            self.log("[SUCCESS] API server stopped")
    
    def get_api_status(self) -> Dict[str, Any]:
        """API status query"""
        return {
            "watchdog": {
                "running": self.is_running,
                "check_interval": self.check_interval,
                "mode": "monitor_only"
            },
            "comfyui": {
                "port": self.comfyui_port,
                "responsive": self.is_comfyui_responsive(),
                "process_running": self.comfyui_process and self.comfyui_process.poll() is None,
                "process_pid": self.comfyui_process.pid if self.comfyui_process else None
            },
            "api": {
                "enabled": self.api_enabled,
                "host": self.api_host,
                "port": self.api_port
            },
            "timestamp": datetime.now().isoformat()
        }
    
    def get_recent_logs(self, limit: int = 50) -> Dict[str, Any]:
        """Recent log query"""
        recent_logs = self.log_buffer[-limit:] if limit > 0 else self.log_buffer
        
        return {
            "logs": recent_logs,
            "total_count": len(self.log_buffer),
            "limit": limit,
            "stats": self.log_stats.copy(),
            "log_file": str(self.log_file),
            "buffer_info": {
                "current_size": len(self.log_buffer),
                "max_size": self.max_log_buffer
            },
            "last_updated": datetime.now().isoformat() if self.log_buffer else None
        }
    
    def manual_restart(self) -> bool:
        """Manual restart request"""
        self.log("Manual restart requested via API", 'api')
        
        # Request pre-status logging
        is_responsive = self.is_comfyui_responsive()
        self.log(f"Pre-restart status - ComfyUI responsive: {is_responsive}", 'restart')
        
        try:
            result = self.restart_comfyui()
            if result:
                self.log("Manual restart request completed successfully", 'success')
            else:
                self.log("Manual restart request failed", 'error')
            return result
        except Exception as e:
            self.log(f"Exception during manual restart: {e}", 'error')
            return False
    
    def update_config(self, new_config: Dict[str, Any]) -> bool:
        """Configuration update"""
        try:
            if 'check_interval' in new_config:
                self.check_interval = max(10, int(new_config['check_interval']))
                self.log(f"📝 Check interval updated to {self.check_interval}s")
            
            return True
        except Exception as e:
            self.log(f"[ERROR] Config update failed: {e}")
            return False
    
    def is_comfyui_responsive(self) -> bool:
        """ComfyUI server response check"""
        try:
            response = requests.get(
                f"http://localhost:{self.comfyui_port}/", 
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def find_comfyui_process(self) -> Optional[psutil.Process]:
        """Find running ComfyUI process"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and any('main.py' in arg for arg in cmdline):
                        # Find ComfyUI process with matching port
                        if any(str(self.comfyui_port) in arg for arg in cmdline):
                            return psutil.Process(proc.info['pid'])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            self.log(f"[ERROR] Error finding ComfyUI process: {e}")
        return None
    
    def start_comfyui(self) -> bool:
        """ComfyUI process start"""
        try:
            self.log("[START] Starting ComfyUI process...")
            
            # Current environment variables copy
            env = os.environ.copy()
            
            # ComfyUI start command
            cmd = [self.python_executable] + self.comfyui_args
            
            # Prevent recursive spawn
            if any('watchdog' in str(arg).lower() for arg in self.comfyui_args):
                self.log("[ERROR] WARNING: Detected watchdog script in args - preventing recursive spawn")
                self.log(f"   Problematic args: {self.comfyui_args}")
                return False
            
            self.log(f"   Command: {' '.join(cmd)}")
            self.log(f"   Working Directory: {self.comfyui_dir}")
            
            # Start ComfyUI process in a new process group (for isolation)
            # Redirect stdout/stderr to file to prevent pipe buffer issues
            log_file = Path(__file__).parent / "comfyui_output.log"
            
            if os.name == 'nt':  # Windows
                with open(log_file, 'w', encoding='utf-8') as log_f:
                    self.comfyui_process = subprocess.Popen(
                        cmd,
                        cwd=self.comfyui_dir,
                        env=env,
                        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                        stdout=log_f,
                        stderr=subprocess.STDOUT  # Merge stderr to stdout
                    )
            else:  # Unix/Linux/Mac
                with open(log_file, 'w', encoding='utf-8') as log_f:
                    self.comfyui_process = subprocess.Popen(
                        cmd,
                        cwd=self.comfyui_dir,
                        env=env,
                        preexec_fn=os.setsid,
                        stdout=log_f,
                        stderr=subprocess.STDOUT  # Merge stderr to stdout
                    )
            
            self.log(f"ComfyUI output will be logged to: {log_file}", 'debug')
            
            self.log(f"[SUCCESS] ComfyUI process started (PID: {self.comfyui_process.pid})")
            return True
            
        except Exception as e:
            self.log(f"[ERROR] Failed to start ComfyUI: {e}")
            return False
    
    def stop_comfyui(self) -> bool:
        """ComfyUI process stop"""
        try:
            if self.comfyui_process:
                if self.comfyui_process.poll() is None:
                    # Process is still running
                    self.log(f"[STOP] Stopping active ComfyUI process (PID: {self.comfyui_process.pid})...")
                    
                    # Attempt graceful termination
                    self.comfyui_process.terminate()
                    
                    # Wait for process to terminate
                    try:
                        self.comfyui_process.wait(timeout=10)
                        self.log("[SUCCESS] ComfyUI process stopped gracefully")
                    except subprocess.TimeoutExpired:
                        # Force kill
                        self.log("[WARN] Force killing ComfyUI process...")
                        self.comfyui_process.kill()
                        self.comfyui_process.wait()
                        self.log("[KILL] ComfyUI process force killed")
                else:
                    # Process was already stopped
                    self.log(f"[STOP] ComfyUI process was already stopped (PID: {self.comfyui_process.pid})")
                
                self.comfyui_process = None
            else:
                # No process to stop
                self.log("[STOP] No ComfyUI process to stop (already stopped or never started)")
            
            # Check for any remaining ComfyUI processes and terminate
            orphaned_process = self.find_comfyui_process()
            if orphaned_process:
                self.log(f"[STOP] Found orphaned ComfyUI process (PID: {orphaned_process.pid}), terminating...")
                try:
                    orphaned_process.terminate()
                    orphaned_process.wait(timeout=5)
                    self.log("[SUCCESS] Orphaned ComfyUI process terminated")
                except:
                    self.log("[WARN] Could not terminate orphaned process")
            
            return True
            
        except Exception as e:
            self.log(f"[ERROR] Error stopping ComfyUI: {e}")
            # Error even though process reference is initialized
            self.comfyui_process = None
            return False
    
    def restart_comfyui(self) -> bool:
        """ComfyUI manual restart (only executed by API request)"""
        restart_start_time = time.time()
        self.log("Manual restart sequence initiated", 'restart')
        
        # Current status check and logging
        current_responsive = self.is_comfyui_responsive()
        self.log(f"Current ComfyUI status - Responsive: {current_responsive}", 'restart')
        
        if self.comfyui_process:
            process_running = self.comfyui_process.poll() is None
            pid = self.comfyui_process.pid if process_running else 'None'
            self.log(f"Current process status - Running: {process_running}, PID: {pid}", 'restart')
        else:
            self.log("No tracked ComfyUI process found", 'restart')
        
        # 1. Existing process stop
        self.log("Step 1/3: Stopping existing ComfyUI process", 'restart')
        stop_start_time = time.time()
        stop_success = self.stop_comfyui()
        stop_duration = time.time() - stop_start_time
        
        if stop_success:
            self.log(f"Process stop completed successfully in {stop_duration:.2f}s", 'success')
        else:
            self.log(f"Process stop had issues but continuing (took {stop_duration:.2f}s)", 'warning')
        
        # 2. Wait time
        self.log("Step 2/3: Waiting for clean shutdown...", 'restart')
        wait_time = 3
        time.sleep(wait_time)
        
        # Execution settings check and logging
        self.log("Step 3/3: Starting new ComfyUI process", 'restart')
        self.log(f"Configuration check:", 'debug')
        self.log(f"  Python: {self.python_executable}", 'debug')
        self.log(f"  Working Dir: {self.comfyui_dir}", 'debug')  
        self.log(f"  Args: {' '.join(map(str, self.comfyui_args))}", 'debug')
        self.log(f"  Port: {self.comfyui_port}", 'debug')
        
        # 3. New process start
        start_time = time.time()
        success = self.start_comfyui()
        start_duration = time.time() - start_time
        
        if success:
            self.log(f"Process start completed in {start_duration:.2f}s", 'success')
            
            # 4. Process status check
            time.sleep(2)  # Ensure process has started
            if self.comfyui_process and self.comfyui_process.poll() is not None:
                # Process has already terminated - error occurred
                self.log(f"ComfyUI process exited immediately with code: {self.comfyui_process.returncode}", 'error')
                
                # Check output log file
                log_file = Path(__file__).parent / "comfyui_output.log"
                try:
                    if log_file.exists():
                        with open(log_file, 'r', encoding='utf-8') as f:
                            output = f.read()
                            if output:
                                # Log last 500 characters
                                self.log(f"ComfyUI output (last 500 chars): {output[-500:]}", 'error')
                            else:
                                self.log("ComfyUI output log is empty", 'error')
                    else:
                        self.log("ComfyUI output log file not found", 'error')
                except Exception as e:
                    self.log(f"Failed to read ComfyUI output log: {e}", 'error')
                    
                return False
            
            # 5. Response check (longer wait)
            self.log("Waiting for ComfyUI to become responsive...", 'restart')
            wait_start = time.time()
            max_wait = 45  # 45 seconds wait (longer)
            
            while time.time() - wait_start < max_wait:
                time.sleep(2)
                
                # Check if process is still running
                if self.comfyui_process and self.comfyui_process.poll() is not None:
                    self.log(f"ComfyUI process died during startup (exit code: {self.comfyui_process.returncode})", 'error')
                    return False
                
                if self.is_comfyui_responsive():
                    response_time = time.time() - wait_start
                    total_time = time.time() - restart_start_time
                    self.log(f"ComfyUI is now responsive! (response in {response_time:.2f}s, total restart {total_time:.2f}s)", 'success')
                    return True
                else:
                    elapsed = time.time() - wait_start
                    self.log(f"Still waiting for response... ({elapsed:.1f}s/{max_wait}s)", 'debug')
            
            # No response after 45 seconds
            total_time = time.time() - restart_start_time
            self.log(f"Process started but not responsive after {max_wait}s (total restart time: {total_time:.2f}s)", 'warning')
            
            # Check if process is still running
            if self.comfyui_process and self.comfyui_process.poll() is None:
                self.log("ComfyUI process is still running - may need more time to load", 'info')
                return True  # Process is still running, consider it a success
            else:
                self.log("ComfyUI process has stopped - restart failed", 'error')
                return False
            
        else:
            total_time = time.time() - restart_start_time
            self.log(f"Failed to start new process (total attempt time: {total_time:.2f}s)", 'error')
            return False
    
    def monitor_loop(self):
        """Main monitoring loop - only status monitoring, no automatic restart"""
        self.log("[WATCHDOG] Enhanced External Watchdog monitoring started")        
        
        while self.is_running:
            try:
                # ComfyUI status check only, no automatic restart
                is_responsive = self.is_comfyui_responsive()
                if not is_responsive:
                    # Log only on first detection (spam protection)
                    if not hasattr(self, '_last_down_logged') or not self._last_down_logged:
                        self.log("[MONITOR] ComfyUI is not responsive - waiting for manual restart request")
                        self._last_down_logged = True
                else:
                    # Log when ComfyUI recovers
                    if hasattr(self, '_last_down_logged') and self._last_down_logged:
                        self.log("[MONITOR] ComfyUI is responsive again")
                        self._last_down_logged = False
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                self.log("[STOP] Watchdog interrupted by user")
                break
            except Exception as e:
                self.log(f"[ERROR] Unexpected error in monitor loop: {e}")
                time.sleep(5)
        
        self.log("[WATCHDOG] Enhanced External Watchdog monitoring stopped")
    
    def run(self):
        """Run watchdog service"""
        try:
            self.log("[WATCHDOG] Starting Enhanced External Watchdog", 'success')
            self.log(f"ComfyUI Path: {self.comfyui_dir}", 'info')
            self.log(f"ComfyUI Port: {self.comfyui_port}", 'info')
            self.log(f"Watchdog API Port: {self.api_port}", 'info')
            
            # Start API server
            self.start_api_server()
            
            # Start monitoring loop
            self.log("[WATCHDOG] Starting monitoring loop...", 'info')
            self.monitor_loop()
            
        finally:
            # Cleanup
            self.stop_api_server()
            self.stop_comfyui()
            self.log("[WATCHDOG] Enhanced External Watchdog shutdown complete")


def check_port_in_use(port: int) -> bool:
    """Check if port is already in use"""
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(('localhost', port))
            return result == 0
    except:
        return False


def main():
    """Main function - no fallback logic"""
    # Print intro message to terminal
    print("=" * 60)
    print("  ComfyUI External Watchdog Service")
    print("=" * 60)
    print("This terminal window shows the ComfyUI watchdog service.")
    print("The watchdog monitors ComfyUI and provides restart functionality.")
    print("Do NOT close this window while using ComfyUI Mobile UI.")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    parser = argparse.ArgumentParser(description='Enhanced ComfyUI External Watchdog with API')
    parser.add_argument('--api-port', type=int, required=True, help='API server port (required)')
    
    args = parser.parse_args()
    
    print(f"[INIT] Watchdog API Port: {args.api_port}")
    
    # Check if port is already in use
    if check_port_in_use(args.api_port):
        print(f"[ERROR] Port {args.api_port} is already in use. Another watchdog may be running.")
        time.sleep(0.1)  # Ensure log is written
        sys.exit(1)
    
    print("[INIT] Starting watchdog service...")
    watchdog = EnhancedExternalComfyUIWatchdog(args.api_port)
    watchdog.run()


if __name__ == "__main__":
    main()