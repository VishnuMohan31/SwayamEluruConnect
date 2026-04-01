"""
SHG (Self Help Group) routes
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import uuid
import os
from pathlib import Path
import shutil

from ..core.deps import get_db, get_current_admin
from ..models.shg import SHG
from ..schemas.shg import SHGCreate, SHGUpdate, SHGResponse
from ..config import settings

router = APIRouter()


@router.get("/", response_model=List[SHGResponse])
async def get_shgs(
    skip: int = 0,
    limit: Optional[int] = None,
    include_inactive: bool = False,
    type: str = None,
    db: Session = Depends(get_db)
):
    """Get all SHGs"""
    query = db.query(SHG)
    if not include_inactive:
        query = query.filter(SHG.is_active == True)
    if type and type in ['SHG']:
        query = query.filter(SHG.type == type)
    
    query = query.order_by(SHG.updated_at.desc().nullslast(), SHG.name.asc())
    
    if limit is not None:
        query = query.offset(skip).limit(limit)
    else:
        query = query.offset(skip)
    
    shgs = query.all()
    return shgs


@router.get("/{shg_id}", response_model=SHGResponse)
async def get_shg(shg_id: str, db: Session = Depends(get_db)):
    """Get SHG by ID"""
    shg = db.query(SHG).filter(SHG.id == shg_id).first()
    if not shg:
        raise HTTPException(status_code=404, detail="SHG not found")
    return shg


@router.post("/", response_model=SHGResponse)
async def create_shg(
    shg: SHGCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Create new SHG - Auto-fills state/district from super admin"""
    shg_data = shg.dict()
    
    # Check for duplicate mobile number
    existing_shg = db.query(SHG).filter(SHG.mobile_number == shg_data['mobile_number']).first()
    if existing_shg:
        raise HTTPException(
            status_code=400, 
            detail=f"Mobile number already registered with SHG '{existing_shg.name}' (ID: {existing_shg.id})"
        )
    
    # If super admin, auto-fill their state and district
    if current_user.role == 'super_admin':
        shg_data['state'] = current_user.state
        shg_data['district'] = current_user.district
    
    # Generate ID for SHG
    result = db.execute(text("SELECT nextval('shgs_id_seq')"))
    seq_num = result.scalar()
    shg_id = f"SHG{seq_num:03d}"
    
    # Create SHG
    db_shg = SHG(id=shg_id, **shg_data, created_by=current_user.id)
    db.add(db_shg)
    db.commit()
    db.refresh(db_shg)
    
    print(f"✅ SHG created: {shg_id} - {shg.name}")
    return db_shg


@router.put("/{shg_id}", response_model=SHGResponse)
async def update_shg(
    shg_id: str,
    shg_update: SHGUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Update SHG"""
    db_shg = db.query(SHG).filter(SHG.id == shg_id).first()
    if not db_shg:
        raise HTTPException(status_code=404, detail="SHG not found")
    
    update_data = shg_update.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_shg, field, value)
    
    db_shg.updated_by = current_user.id
    db.commit()
    db.refresh(db_shg)
    return db_shg


@router.put("/{shg_id}/deactivate")
async def deactivate_shg(
    shg_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Deactivate SHG (soft delete)"""
    db_shg = db.query(SHG).filter(SHG.id == shg_id).first()
    if not db_shg:
        raise HTTPException(status_code=404, detail="SHG not found")
    
    db_shg.is_active = False
    db_shg.updated_by = current_user.id
    db.commit()
    db.refresh(db_shg)
    return {"message": "SHG deactivated successfully", "shg": db_shg}


@router.put("/{shg_id}/reactivate")
async def reactivate_shg(
    shg_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Reactivate SHG"""
    db_shg = db.query(SHG).filter(SHG.id == shg_id).first()
    if not db_shg:
        raise HTTPException(status_code=404, detail="SHG not found")
    
    db_shg.is_active = True
    db_shg.updated_by = current_user.id
    db.commit()
    db.refresh(db_shg)
    return {"message": "SHG reactivated successfully", "shg": db_shg}


@router.post("/upload-image")
async def upload_shg_image(
    file: UploadFile = File(...),
    current_user = Depends(get_current_admin)
):
    """Upload SHG/Contact person image"""
    print(f"📤 SHG Image upload started: {file.filename} by {current_user.id}")
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        print(f"❌ Invalid file type: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (max 2MB)
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > 2 * 1024 * 1024:
        print(f"❌ File too large: {file_size / (1024*1024):.2f}MB")
        raise HTTPException(status_code=400, detail="File size must be less than 2MB")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Save file
    storage_path = Path(settings.STORAGE_PATH) / "shgs"
    storage_path.mkdir(parents=True, exist_ok=True)
    file_path = storage_path / unique_filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return relative URL
    image_url = f"/storage/shgs/{unique_filename}"
    print(f"✅ SHG Image uploaded successfully: {image_url} ({file_size / 1024:.2f}KB)")
    return {"image_url": image_url, "filename": unique_filename}
