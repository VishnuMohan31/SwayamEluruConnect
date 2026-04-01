"""
Inquiry routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from ..core.deps import get_db, get_current_admin
from ..models.inquiry import ContactLog, Buyer
from ..models.product import Product
from ..schemas.inquiry import InquiryCreate, InquiryUpdate, InquiryResponse

router = APIRouter()


@router.get("/", response_model=List[InquiryResponse])
async def get_inquiries(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Get all contact logs (admin only)"""
    query = db.query(ContactLog)
    if limit is not None:
        query = query.offset(skip).limit(limit)
    else:
        query = query.offset(skip)
    contact_logs = query.all()
    return contact_logs


@router.get("/{contact_id}", response_model=InquiryResponse)
async def get_inquiry(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Get contact log by ID"""
    contact_log = db.query(ContactLog).filter(ContactLog.id == contact_id).first()
    if not contact_log:
        raise HTTPException(status_code=404, detail="Contact log not found")
    return contact_log


@router.post("/", response_model=InquiryResponse)
async def create_inquiry(
    inquiry: InquiryCreate,
    db: Session = Depends(get_db)
):
    """Create new contact log (public endpoint)"""
    from sqlalchemy import text
    from fastapi import Request
    
    # Note: IP address should be captured from request headers in production
    # For now, we'll use the provided IP or default
    client_ip = inquiry.ip_address if inquiry.ip_address and inquiry.ip_address != '0.0.0.0' else '127.0.0.1'
    
    # Create or get buyer (lookup by phone number)
    buyer = db.query(Buyer).filter(Buyer.phone == inquiry.phone).first()
    if not buyer:
        # Generate buyer ID
        result = db.execute(text("SELECT nextval('buyers_id_seq')"))
        seq_num = result.scalar()
        buyer_id = f"BYR{seq_num:03d}"
        
        buyer = Buyer(
            id=buyer_id,
            name=inquiry.name,
            email=inquiry.email if inquiry.email else None,  # Store None if email is empty
            location=inquiry.location,
            phone=inquiry.phone
        )
        db.add(buyer)
        db.flush()
    
    # Get product to find SHG
    product = db.query(Product).filter(Product.id == inquiry.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Generate contact log ID
    result = db.execute(text("SELECT nextval('contact_logs_id_seq')"))
    seq_num = result.scalar()
    contact_id = f"CNT{seq_num:03d}"
    
    # Create contact log
    contact_log = ContactLog(
        id=contact_id,
        buyer_id=buyer.id,
        product_id=inquiry.product_id,
        shg_id=product.shg_id,
        ip_address=client_ip
    )
    db.add(contact_log)
    
    db.commit()
    db.refresh(contact_log)
    return contact_log


@router.delete("/{contact_id}")
async def delete_inquiry(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Delete contact log"""
    contact_log = db.query(ContactLog).filter(ContactLog.id == contact_id).first()
    if not contact_log:
        raise HTTPException(status_code=404, detail="Contact log not found")
    
    db.delete(contact_log)
    db.commit()
    return {"message": "Contact log deleted successfully"}
