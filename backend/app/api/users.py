"""
User management routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime

from ..core.deps import get_db, get_current_admin, get_current_user
from ..core.security import get_password_hash
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate, UserResponse, ChangePasswordRequest

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = None,
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Get all users (admin only) - can filter by role"""
    query = db.query(User).filter(User.is_active == True)
    
    if role:
        query = query.filter(User.role == role)
    
    if limit is not None:
        query = query.offset(skip).limit(limit)
    else:
        query = query.offset(skip)
    
    users = query.all()
    return users


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user = Depends(get_current_user)
):
    """Get current user's profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    update_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update current user's profile (name and mobile only) - State/District locked for super_admin"""
    # Only allow updating name and mobile
    if 'full_name' in update_data and update_data['full_name']:
        current_user.full_name = update_data['full_name']
    if 'mobile_number' in update_data and update_data['mobile_number']:
        current_user.mobile_number = update_data['mobile_number']
    
    # LOCK state and district for super_admin users
    if current_user.role == 'super_admin':
        if 'state' in update_data or 'district' in update_data:
            print(f"⚠️  Blocked attempt by super_admin {current_user.id} to update their own state/district")
    
    current_user.updated_at = datetime.utcnow()
    current_user.updated_by = current_user.id
    
    db.commit()
    db.refresh(current_user)
    
    print(f"✅ User {current_user.id} profile updated")
    return current_user


@router.put("/me/change-password")
async def change_own_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Change current user's password"""
    from ..core.security import verify_password
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.updated_at = datetime.utcnow()
    
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Create new user (admin only)"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate ID
    result = db.execute(text("SELECT nextval('users_id_seq')"))
    seq_num = result.scalar()
    prefix = 'ADM' if user.role == 'admin' else 'SAD'
    user_id = f"{prefix}{seq_num:03d}"
    
    # Create user
    db_user = User(
        id=user_id,
        email=user.email,
        full_name=user.full_name,
        mobile_number=user.mobile_number,
        state=user.state,
        district=user.district,
        role=user.role,
        hashed_password=get_password_hash(user.password),
        created_by=current_user.id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    print(f"✅ User created: {user_id} ({user.role}) - State: {user.state}, District: {user.district}")
    return db_user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Update user (admin only) - State and District are locked for super_admin role"""
    db_user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    
    # LOCK state and district for super_admin users
    if db_user.role == 'super_admin':
        if 'state' in update_data:
            update_data.pop('state')
            print(f"⚠️  Blocked attempt to update state for super_admin {user_id}")
        if 'district' in update_data:
            update_data.pop('district')
            print(f"⚠️  Blocked attempt to update district for super_admin {user_id}")
    
    # Handle password update separately
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")
    
    # Update fields
    for field, value in update_data.items():
        if hasattr(db_user, field):
            setattr(db_user, field, value)
    
    db_user.updated_at = datetime.utcnow()
    db_user.updated_by = current_user.id
    
    db.commit()
    db.refresh(db_user)
    
    print(f"✅ User {user_id} updated successfully")
    return db_user


@router.put("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Deactivate user (soft delete)"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.is_active = False
    db_user.deleted_at = datetime.utcnow()
    db_user.deleted_by = current_user.id
    
    db.commit()
    return {"message": "User deactivated successfully"}


@router.put("/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Reactivate user"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.is_active = True
    db_user.deleted_at = None
    db_user.deleted_by = None
    db_user.updated_at = datetime.utcnow()
    db_user.updated_by = current_user.id
    
    db.commit()
    return {"message": "User reactivated successfully"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Hard delete user (admin only) - use deactivate instead"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}
