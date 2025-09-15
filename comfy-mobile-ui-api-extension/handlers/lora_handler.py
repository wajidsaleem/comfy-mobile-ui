
import os
import json
from typing import Dict, List, Any, Optional
from aiohttp import web
import folder_paths

def get_mobile_data_path():
    """Get the mobile_data directory path"""
    return os.path.join(folder_paths.base_path, "mobile_data")

def get_trigger_words_file_path():
    """Get the trigger words JSON file path"""
    mobile_data_path = get_mobile_data_path()
    return os.path.join(mobile_data_path, "trigger_words.json")

def ensure_mobile_data_directory():
    """Ensure mobile_data directory exists"""
    mobile_data_path = get_mobile_data_path()
    os.makedirs(mobile_data_path, exist_ok=True)
    return mobile_data_path


def load_trigger_words():
    """Load trigger words from JSON file"""
    trigger_words_path = get_trigger_words_file_path()
    
    if not os.path.exists(trigger_words_path):
        return {}
    
    try:
        with open(trigger_words_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading trigger words: {e}")
        return {}

def save_trigger_words(trigger_words_data):
    """Save trigger words to JSON file"""
    ensure_mobile_data_directory()
    trigger_words_path = get_trigger_words_file_path()
    
    try:
        with open(trigger_words_path, 'w', encoding='utf-8') as f:
            json.dump(trigger_words_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving trigger words: {e}")
        return False

def rename_trigger_word_key(old_filename, new_filename):
    """Rename trigger word key when a model file is renamed"""
    try:
        # Load existing trigger words
        trigger_words = load_trigger_words()
        
        # Check if old filename exists as a key
        if old_filename in trigger_words:
            # Move the trigger words to the new key
            trigger_words[new_filename] = trigger_words[old_filename]
            # Remove the old key
            del trigger_words[old_filename]
            
            # Save the updated trigger words
            if save_trigger_words(trigger_words):
                print(f"[TRIGGER_WORDS] Successfully renamed key from '{old_filename}' to '{new_filename}'")
                return True
            else:
                print(f"[TRIGGER_WORDS] Failed to save updated trigger words file")
                return False
        else:
            # No trigger words for this file, nothing to rename
            return True
            
    except Exception as e:
        print(f"[TRIGGER_WORDS] Error renaming trigger word key: {e}")
        return False


async def get_lora_trigger_words(request):
    """Get all LoRA trigger words"""
    try:
        trigger_words = load_trigger_words()
        
        return web.json_response({
            "success": True,
            "trigger_words": trigger_words,
            "total_loras": len(trigger_words),
            "file_path": get_trigger_words_file_path()
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to get LoRA trigger words: {str(e)}",
            "trigger_words": {}
        }, status=500)

async def get_lora_trigger_words_single(request):
    """Get trigger words for a specific LoRA"""
    try:
        lora_name = request.match_info['lora_name']
        
        trigger_words = load_trigger_words()
        lora_trigger_words = trigger_words.get(lora_name, [])
        
        return web.json_response({
            "success": True,
            "lora_name": lora_name,
            "trigger_words": lora_trigger_words,
            "total_words": len(lora_trigger_words)
        })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to get LoRA trigger words: {str(e)}",
            "lora_name": request.match_info.get('lora_name', ''),
            "trigger_words": []
        }, status=500)



async def set_lora_trigger_words(request):
    """Set trigger words for a specific LoRA"""
    try:
        data = await request.json()
        
        # Validate required parameters
        required_fields = ['lora_name', 'trigger_words']
        for field in required_fields:
            if field not in data:
                return web.json_response({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }, status=400)
        
        lora_name = data['lora_name']
        new_trigger_words = data['trigger_words']
        
        # Validate trigger_words is a list
        if not isinstance(new_trigger_words, list):
            return web.json_response({
                "success": False,
                "error": "trigger_words must be an array"
            }, status=400)
        
        # Clean and validate trigger words
        clean_trigger_words = []
        for word in new_trigger_words:
            if isinstance(word, str) and word.strip():
                clean_trigger_words.append(word.strip())
        
        # Load existing trigger words
        all_trigger_words = load_trigger_words()
        
        # Update trigger words for this LoRA
        if clean_trigger_words:
            all_trigger_words[lora_name] = clean_trigger_words
        else:
            # Remove entry if no trigger words
            if lora_name in all_trigger_words:
                del all_trigger_words[lora_name]
        
        # Save updated trigger words
        if save_trigger_words(all_trigger_words):
            return web.json_response({
                "success": True,
                "message": f"Trigger words updated successfully for {lora_name}",
                "lora_name": lora_name,
                "trigger_words": clean_trigger_words,
                "total_words": len(clean_trigger_words)
            })
        else:
            return web.json_response({
                "success": False,
                "error": "Failed to save trigger words to file"
            }, status=500)
        
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


async def delete_lora_trigger_words(request):
    """Delete all trigger words for a specific LoRA"""
    try:
        lora_name = request.match_info['lora_name']
        
        # Load existing trigger words
        all_trigger_words = load_trigger_words()
        
        # Remove trigger words for this LoRA
        if lora_name in all_trigger_words:
            del all_trigger_words[lora_name]
            
            # Save updated trigger words
            if save_trigger_words(all_trigger_words):
                return web.json_response({
                    "success": True,
                    "message": f"Trigger words deleted successfully for {lora_name}",
                    "lora_name": lora_name
                })
            else:
                return web.json_response({
                    "success": False,
                    "error": "Failed to save trigger words to file"
                }, status=500)
        else:
            return web.json_response({
                "success": True,
                "message": f"No trigger words found for {lora_name}",
                "lora_name": lora_name
            })
        
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": f"Failed to delete LoRA trigger words: {str(e)}"
        }, status=500)

async def batch_update_trigger_words(request):
    """Batch update trigger words for multiple LoRAs"""
    try:
        data = await request.json()
        
        # Validate required parameters
        if 'updates' not in data:
            return web.json_response({
                "success": False,
                "error": "Missing required field: updates"
            }, status=400)
        
        updates = data['updates']
        
        # Validate updates is a dict
        if not isinstance(updates, dict):
            return web.json_response({
                "success": False,
                "error": "updates must be an object with lora_name as keys and trigger_words arrays as values"
            }, status=400)
        
        # Load existing trigger words
        all_trigger_words = load_trigger_words()
        
        # Process updates
        updated_count = 0
        results = {}
        
        for lora_name, new_trigger_words in updates.items():
            try:
                # Validate trigger_words is a list
                if not isinstance(new_trigger_words, list):
                    results[lora_name] = {
                        "success": False,
                        "error": "trigger_words must be an array"
                    }
                    continue
                
                # Clean and validate trigger words
                clean_trigger_words = []
                for word in new_trigger_words:
                    if isinstance(word, str) and word.strip():
                        clean_trigger_words.append(word.strip())
                
                # Update trigger words for this LoRA
                if clean_trigger_words:
                    all_trigger_words[lora_name] = clean_trigger_words
                    results[lora_name] = {
                        "success": True,
                        "trigger_words": clean_trigger_words,
                        "total_words": len(clean_trigger_words)
                    }
                else:
                    # Remove entry if no trigger words
                    if lora_name in all_trigger_words:
                        del all_trigger_words[lora_name]
                    results[lora_name] = {
                        "success": True,
                        "trigger_words": [],
                        "total_words": 0,
                        "message": "Removed trigger words (empty list provided)"
                    }
                
                updated_count += 1
                
            except Exception as e:
                results[lora_name] = {
                    "success": False,
                    "error": str(e)
                }
        
        # Save updated trigger words
        if save_trigger_words(all_trigger_words):
            return web.json_response({
                "success": True,
                "message": f"Batch update completed. Updated {updated_count} LoRAs",
                "updated_count": updated_count,
                "total_requested": len(updates),
                "results": results
            })
        else:
            return web.json_response({
                "success": False,
                "error": "Failed to save trigger words to file",
                "results": results
            }, status=500)
        
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

