import os
import json
import hashlib
from datetime import datetime
from functools import wraps
from typing import Any, Optional, Dict, List
import logging

# Directory to store cache files (V3.0 Internal)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "cache")

logger = logging.getLogger("CACHE_SERVICE")

class CacheService:
    @staticmethod
    def _get_cache_path(key: str) -> str:
        """Hash the key to create a unique filename"""
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR, exist_ok=True)
        
        safe_key = hashlib.md5(key.encode()).hexdigest()
        return os.path.join(CACHE_DIR, f"{safe_key}.json")

    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Retrieve data from cache if it exists and is still for today"""
        path = f"{CacheService._get_cache_path(key)}"
        if not os.path.exists(path):
            return None
        
        try:
            # Get file modification time
            mtime = os.path.getmtime(path)
            cache_date = datetime.fromtimestamp(mtime).date()
            
            # If cache is from a previous day, consider it expired
            if cache_date < datetime.now().date():
                return None
                
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading cache: {e}")
            return None

    @staticmethod
    def set(key: str, data: Any):
        """Save data to cache"""
        path = CacheService._get_cache_path(key)
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error writing cache: {e}")

    @staticmethod
    def clear():
        """Delete all cached files"""
        if not os.path.exists(CACHE_DIR):
            return
        
        logger.info(f"Clearing all cache files in {CACHE_DIR}")
        for filename in os.listdir(CACHE_DIR):
            if filename.endswith(".json"):
                try:
                    os.remove(os.path.join(CACHE_DIR, filename))
                except Exception as e:
                    logger.error(f"Error removing cache file {filename}: {e}")

def cache_response(ttl_hours: int = 24):
    """
    FastAPI Cache Decorator - Simple and Elite.
    Caches based on function name and all keyword arguments.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a unique key based on endpoint name and parameters
            # Exclude 'db' session object, and handle 'current_user' specially
            cache_params = {}
            user_id_prefix = ""
            
            for k, v in kwargs.items():
                if k == 'db':
                    continue
                if k in ['current_user', 'user'] and hasattr(v, 'id'):
                    user_id_prefix = f"u{v.id}:"
                    continue
                cache_params[k] = v
            
            key = f"{user_id_prefix}{func.__name__}:{json.dumps(cache_params, sort_keys=True)}"
            
            # 1. Try to get from cache
            cached_val = CacheService.get(key)
            if cached_val is not None:
                # logger.info(f"Cache HIT for {func.__name__}")
                return cached_val
            
            # 2. If not in cache, execute original function
            import inspect
            if inspect.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # 3. Save result to cache
            CacheService.set(key, result)
            return result
        return wrapper
    return decorator
