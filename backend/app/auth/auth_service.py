from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from jose import jwt, JWTError

from ..database import get_db
from ..models import User, UserSession
from ..core.security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    actual_user = db.query(User).options(joinedload(User.role)).filter(User.username == username).first()
    if actual_user is None:
        raise credentials_exception
        
    # Giai đoạn 1: Kiểm tra Phiên làm việc (Session Management)
    session = db.query(UserSession).filter(
        UserSession.user_id == actual_user.id,
        UserSession.session_token == token,
        UserSession.is_active == True
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc đã hết hạn hoặc bị quản trị viên chấm dứt",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Cập nhật thời gian hoạt động cuối
    session.last_activity = datetime.now()
    db.commit()

    # Elite Simulation Support (RBAC 3.0)
    simulate_user_id = request.headers.get("X-Simulate-User-ID")
    if simulate_user_id and actual_user.role and actual_user.role.name.strip().upper() in ["ADMIN", "SUPERADMIN"]:
        try:
            target_id = int(simulate_user_id)
            sim_user = db.query(User).options(
                joinedload(User.role),
                joinedload(User.scope_node),
                joinedload(User.nhan_su)
            ).filter(User.id == target_id).first()
            if sim_user:
                return sim_user
        except (ValueError, TypeError):
            pass

    return actual_user
