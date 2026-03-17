"""
Product routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import uuid
import os
from pathlib import Path
import shutil

from ..core.deps import get_db, get_current_admin
from ..models.product import Product
from ..models.category import Category
from ..models.shg import SHG
from ..schemas.product import ProductCreate, ProductUpdate, ProductResponse
from ..config import settings

router = APIRouter()


@router.get("/most-contacted", response_model=List[ProductResponse])
async def get_most_contacted_products(
    limit: int = 4,
    db: Session = Depends(get_db)
):
    """Get products with most inquiries"""
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload
    from ..models.inquiry import ContactLog

    # First get product IDs with contact counts
    subquery = db.query(
        Product.id,
        func.count(ContactLog.id).label('contact_count')
    ).join(
        ContactLog, Product.id == ContactLog.product_id, isouter=True
    ).filter(
        Product.is_active == True
    ).group_by(
        Product.id
    ).order_by(
        func.count(ContactLog.id).desc()
    ).limit(limit).subquery()

    # Then fetch full products with relationships
    products = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.shg)
    ).join(
        subquery, Product.id == subquery.c.id
    ).all()

    return products


@router.get("/recent", response_model=List[ProductResponse])
async def get_recent_products(
    limit: int = 4,
    db: Session = Depends(get_db)
):
    """Get recently added products"""
    from sqlalchemy.orm import joinedload
    
    products = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.shg)
    ).filter(
        Product.is_active == True
    ).order_by(
        Product.created_at.desc()
    ).limit(limit).all()

    return products


@router.get("/", response_model=List[ProductResponse])
async def get_products(
    skip: int = 0,
    limit: Optional[int] = None,
    category_id: Optional[str] = None,
    shg_id: Optional[str] = None,
    search: Optional[str] = None,
    is_featured: Optional[bool] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """Get all products with filters"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.shg)
    )
    
    if not include_inactive:
        query = query.filter(Product.is_active == True)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if shg_id:
        query = query.filter(Product.shg_id == shg_id)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if is_featured is not None:
        query = query.filter(Product.is_featured == is_featured)
    
    # Sort by: Recently updated first, then by name
    query = query.order_by(Product.updated_at.desc().nullslast(), Product.name.asc())
    
    products = query.offset(skip).limit(limit).all()
    return products



@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: Session = Depends(get_db)
):
    """Get product by ID"""
    from sqlalchemy.orm import joinedload
    
    product = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.shg)
    ).filter(Product.id == product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Note: We don't increment view_count here to avoid updating updated_at timestamp
    # View tracking is handled separately in product_views table if needed
    
    return product


@router.post("/", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Create new product"""
    # Generate ID
    result = db.execute(text("SELECT nextval('products_id_seq')"))
    seq_num = result.scalar()
    product_id = f"PRD{seq_num:03d}"
    
    # Create product
    db_product = Product(
        id=product_id,
        **product.dict(),
        created_by=current_user.id
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    print(f"✅ Product created: {product_id} - {product.name}")
    return db_product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Update product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)
    
    db_product.updated_by = current_user.id
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/{product_id}/deactivate")
async def deactivate_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Deactivate product (soft delete)"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.is_active = False
    db_product.updated_by = current_user.id
    db.commit()
    db.refresh(db_product)
    return {"message": "Product deactivated successfully", "product": db_product}


@router.put("/{product_id}/reactivate")
async def reactivate_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Reactivate product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.is_active = True
    db_product.updated_by = current_user.id
    db.commit()
    db.refresh(db_product)
    return {"message": "Product reactivated successfully", "product": db_product}


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user = Depends(get_current_admin)
):
    """Upload product image"""
    print(f"📤 Image upload started: {file.filename} by {current_user.id}")
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        print(f"❌ Invalid file type: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (max 3MB for products - up to 5 images)
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > 3 * 1024 * 1024:
        print(f"❌ File too large: {file_size / (1024*1024):.2f}MB")
        raise HTTPException(status_code=400, detail="File size must be less than 3MB")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Save file
    storage_path = Path(settings.STORAGE_PATH) / "products"
    storage_path.mkdir(parents=True, exist_ok=True)
    file_path = storage_path / unique_filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return relative URL
    image_url = f"/storage/products/{unique_filename}"
    print(f"✅ Image uploaded successfully: {image_url} ({file_size / 1024:.2f}KB)")
    return {"image_url": image_url, "filename": unique_filename}
