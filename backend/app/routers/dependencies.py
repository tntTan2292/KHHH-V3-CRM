from fastapi import Depends, HTTPException, status, Header
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Role, NhanSu, HierarchyNode
from ..core.security import SECRET_KEY, ALGORITHM
from ..services.hierarchy_service import HierarchyService

async def get_current_user_scope(
    db: Session = Depends(get_db),
    token: str = Header(None)
):
    if not token or not token.startswith("Bearer "):
        # For now, if no token, allow for testing (remove in production)
        # return {"role": "ADMIN", "scope_ids": []} 
        raise HTTPException(status_code=401, detail="Missing or invalid token")
        
    token = token.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_role: str = payload.get("role")
        node_code: str = payload.get("node_code")
        
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        # Tinh toan scope_ids dua tren hierarchy
        scope_ids = []
        if user_role != "ADMIN" and node_code:
            scope_ids = HierarchyService.get_descendant_ids(db, node_code)
            
        return {
            "username": username,
            "role": user_role,
            "scope_code": node_code,
            "scope_ids": scope_ids
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
