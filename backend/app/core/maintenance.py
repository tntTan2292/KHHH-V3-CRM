# 🔒 MAINTENANCE GOVERNANCE
# Phase 1: Lock all ingestion flows to prevent duplicate data expansion

MAINTENANCE_LOCK = False  # Set to False to unlock after cleanup
CLEANUP_PHASE = "COMPLETED"

def is_sync_locked():
    """Check if the system is under maintenance lock for sync/import."""
    return MAINTENANCE_LOCK
