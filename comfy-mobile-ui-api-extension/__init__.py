# ComfyUI Mobile UI API Extension
# Provides API endpoints for mobile workflow management

try:
    print("[EXTENSION] Loading ComfyUI Mobile UI API Extension...")
    
    # Initialize watchdog service first (auto-detection)
    from .watchdog import initialize_watchdog
    watchdog_success = initialize_watchdog()  # auto-detect all parameters
    
    if watchdog_success:
        print("[EXTENSION] ComfyUI Watchdog service initialized with auto-detection")
    else:
        print("[EXTENSION] ComfyUI Watchdog service failed to initialize")
        print("   Restart functionality may not be available")
    
    # Setup API routes
    from .api import setup_routes
    routes_success = setup_routes()
    
    if routes_success:
        print("[EXTENSION] ComfyUI Mobile UI API Extension loaded successfully!")
        if watchdog_success:
            print("[EXTENSION] Watchdog-powered restart functionality enabled")
    else:
        print("[EXTENSION] ComfyUI Mobile UI API Extension loaded with warnings")
        print("   API endpoints may not be available - check compatibility")
        
except Exception as e:
    print(f"[EXTENSION] Failed to load ComfyUI Mobile UI API Extension: {e}")
    print("   The extension is not functional")
    import traceback
    traceback.print_exc()