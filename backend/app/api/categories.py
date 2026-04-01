"""
Category routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import uuid

from ..core.deps import get_db, get_current_admin
from ..models.category import Category
from ..schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
async def get_categories(
    skip: int = 0,
    limit: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """Get all categories"""
    query = db.query(Category)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    
    query = query.order_by(Category.updated_at.desc().nullslast(), Category.name.asc())
    
    if limit is not None:
        query = query.offset(skip).limit(limit)
    else:
        query = query.offset(skip)
    
    categories = query.all()
    return categories


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    """Get category by ID"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/", response_model=CategoryResponse)
async def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Create new category - Auto-fills state/district from super admin"""
    category_data = category.dict()
    
    # If super admin, auto-fill their state and district
    if current_user.role == 'super_admin':
        category_data['state'] = current_user.state
        category_data['district'] = current_user.district
    
    # Generate ID
    result = db.execute(text("SELECT nextval('categories_id_seq')"))
    seq_num = result.scalar()
    category_id = f"CAT{seq_num:03d}"
    
    # Create category
    db_category = Category(
        id=category_id,
        **category_data,
        created_by=current_user.id
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    print(f"✅ Category created: {category_id} - {category.name}")
    return db_category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    category_update: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Update category"""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = category_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_category, field, value)
    
    db_category.updated_by = current_user.id
    db.commit()
    db.refresh(db_category)
    return db_category


@router.put("/{category_id}/deactivate")
async def deactivate_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Deactivate category (soft delete)"""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db_category.is_active = False
    db_category.updated_by = current_user.id
    db.commit()
    db.refresh(db_category)
    return {"message": "Category deactivated successfully", "category": db_category}


@router.put("/{category_id}/reactivate")
async def reactivate_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Reactivate category"""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db_category.is_active = True
    db_category.updated_by = current_user.id
    db.commit()
    db.refresh(db_category)
    return {"message": "Category reactivated successfully", "category": db_category}
