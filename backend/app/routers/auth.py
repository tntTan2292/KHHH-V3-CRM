from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from datetime import timedelta, datetime
from jose import jwt, JWTError
from pydantic import BaseModel

from ..database import SessionLocal
from ..models import User, Role, NhanSu, HierarchyNode
from ..core.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
from ..services.log_service import LogService
from ..models import UserSession

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/name/{username}")
async def get_name(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return {"name": None}
    return {"name": user.full_name}

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

@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Kiểm tra xem tài khoản có đang bị khóa không
    if user.locked_until and user.locked_until > datetime.now():
        remaining_minutes = int((user.locked_until - datetime.now()).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau {remaining_minutes} phút."
        )

    if not verify_password(form_data.password, user.hashed_password):
        # Tăng số lần thử sai
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now() + timedelta(minutes=30)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sai mật khẩu quá nhiều lần. Tài khoản đã bị khóa 30 phút để bảo mật."
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Đăng nhập thành công -> Reset số lần thử sai và lưu IP
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_ip = request.client.host
    db.commit()
    
    # Lay thong tin quyen va pham vi
    role = db.query(Role).get(user.role_id)
    ns = db.query(NhanSu).get(user.nhan_su_id) if user.nhan_su_id else None
    
    node_code = None
    node_type = None
    if ns and ns.point_id:
        node = db.query(HierarchyNode).get(ns.point_id)
        if node:
            node_code = node.code
            node_type = node.type

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Get effective permissions
    permissions = get_user_permissions(db, user.id)
    
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": role.name if role else "STAFF",
            "full_name": user.full_name,
            "node_code": node_code,
            "node_type": node_type,
            "ns_id": user.nhan_su_id,
            "permissions": permissions
        },
        expires_delta=access_token_expires
    )
    
    # Giai đoạn 1: Lưu Session và Ghi Log
    new_session = UserSession(
        user_id=user.id,
        session_token=access_token,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        is_active=True
    )
    db.add(new_session)
    
    LogService.log_action(
        db=db,
        user_id=user.id,
        action="LOGIN",
        resource="AUTH",
        details=f"Đăng nhập thành công từ IP: {request.client.host}",
        ip_address=request.client.host
    )
    db.commit()
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "full_name": user.full_name,
            "role": role.name if role else "STAFF",
            "scope": node_code if node_code else "Bưu điện thành phố Huế",
            "permissions": permissions,
            "must_change_password": user.must_change_password
        }
    }

from ..auth.permissions import get_user_permissions

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Refresh user data with relationships
    user = db.query(User).options(
        joinedload(User.role),
        joinedload(User.nhan_su),
        joinedload(User.scope_node)
    ).filter(User.id == current_user.id).first()
    
    # Get effective permissions
    permissions = get_user_permissions(db, user.id)
    
    return {
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.name if user.role else "STAFF",
        "role_display": user.role.description if user.role else "Nhân viên",
        "scope": user.scope_node.name if user.scope_node else "Bưu điện thành phố Huế",
        "hr_id": user.nhan_su.hr_id if user.nhan_su else None,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "permissions": permissions
    }

class ChangePasswordPayload(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
async def change_password(
    request: Request,
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác")
    
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 8 ký tự")
    
    current_user.hashed_password = get_password_hash(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="CHANGE_PASSWORD",
        resource="User",
        details="Người dùng tự thay đổi mật khẩu thành công.",
        ip_address=request.client.host
    )
    
    return {"message": "Đã đổi mật khẩu thành công"}

from ..auth.permissions import get_user_permissions
from ..core.security import get_password_hash
