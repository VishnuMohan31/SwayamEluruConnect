"""
Reports routes for exporting data
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import csv
import io
from datetime import datetime

from ..core.deps import get_db, get_current_admin
from ..models.inquiry import ContactLog, Buyer
from ..models.product import Product
from ..models.shg import SHG
from ..models.category import Category
from ..utils.timezone import format_ist_datetime

router = APIRouter()


@router.get("/inquiries/export")
async def export_inquiries(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Export all inquiries to CSV with optional date filtering"""
    from datetime import datetime as dt, timedelta
    
    # Build query
    query = db.query(ContactLog)
    
    # Apply date filters if provided
    if start_date:
        start_dt = dt.strptime(start_date, '%Y-%m-%d')
        query = query.filter(ContactLog.created_at >= start_dt)
    
    if end_date:
        end_dt = dt.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)  # Include entire end date
        query = query.filter(ContactLog.created_at < end_dt)
    
    # Order by newest first
    query = query.order_by(ContactLog.created_at.desc())
    
    contact_logs = query.all()
    
    print(f"📊 Exporting {len(contact_logs)} inquiries (start_date={start_date}, end_date={end_date})")
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Contact ID',
        'Date',
        'Buyer Name',
        'Buyer Email',
        'Buyer Phone',
        'Buyer Location',
        'Product Name',
        'Product ID',
        'Product Description',
        'SHG Name',
        'SHG Type',
        'SHG ID',
        'SHG Contact Person',
        'SHG Mobile Number',
        'SHG Mandal',
        'SHG Village'
    ])
    
    # Write data rows
    for log in contact_logs:
        buyer = db.query(Buyer).filter(Buyer.id == log.buyer_id).first()
        product = db.query(Product).filter(Product.id == log.product_id).first()
        shg = db.query(SHG).filter(SHG.id == log.shg_id).first()
        
        writer.writerow([
            log.id,
            format_ist_datetime(log.created_at),
            buyer.name if buyer else '',
            buyer.email if buyer else '',
            buyer.phone if buyer else '',
            buyer.location if buyer else '',
            product.name if product else '',
            product.id if product else '',
            product.description if product else '',
            shg.name if shg else '',
            shg.type if shg else '',
            shg.id if shg else '',
            shg.contact_person if shg else '',
            shg.mobile_number if shg else '',
            shg.mandal if shg else '',
            shg.village if shg else ''
        ])
    
    # Prepare response
    output.seek(0)
    date_range = f"_{start_date}_to_{end_date}" if start_date and end_date else ""
    filename = f"inquiries_export_{dt.now().strftime('%Y%m%d_%H%M%S')}{date_range}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/analytics/export")
async def export_analytics(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Export analytics data to CSV with optional date filtering"""
    from datetime import datetime as dt, timedelta
    
    # Build query
    query = db.query(Product)
    
    # Apply date filters if provided
    if start_date:
        start_dt = dt.strptime(start_date, '%Y-%m-%d')
        query = query.filter(Product.created_at >= start_dt)
    
    if end_date:
        end_dt = dt.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        query = query.filter(Product.created_at < end_dt)
    
    # Order by newest first
    query = query.order_by(Product.created_at.desc())
    
    products = query.all()
    
    print(f"📊 Exporting analytics for {len(products)} products (start_date={start_date}, end_date={end_date})")
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Product ID',
        'Product Name',
        'Category',
        'SHG / Farmer Name',
        'SHG / Farmer Type',
        'View Count',
        'Contact Count',
        'Status',
        'Created Date'
    ])
    
    # Write data rows
    for product in products:
        category = db.query(Category).filter(Category.id == product.category_id).first()
        shg = db.query(SHG).filter(SHG.id == product.shg_id).first()
        contact_count = db.query(ContactLog).filter(ContactLog.product_id == product.id).count()
        
        writer.writerow([
            product.id,
            product.name,
            category.name if category else '',
            shg.name if shg else '',
            shg.type if shg else '',
            product.view_count,
            contact_count,
            'Active' if product.is_active else 'Inactive',
            format_ist_datetime(product.created_at)
        ])
    
    # Prepare response
    output.seek(0)
    date_range = f"_{start_date}_to_{end_date}" if start_date and end_date else ""
    filename = f"analytics_export_{dt.now().strftime('%Y%m%d_%H%M%S')}{date_range}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/products/export")
async def export_products(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Export all products to CSV with optional date filtering"""
    from datetime import datetime as dt, timedelta
    
    # Build query
    query = db.query(Product)
    
    # Apply date filters if provided
    if start_date:
        start_dt = dt.strptime(start_date, '%Y-%m-%d')
        query = query.filter(Product.created_at >= start_dt)
    
    if end_date:
        end_dt = dt.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        query = query.filter(Product.created_at < end_dt)
    
    # Order by newest first
    query = query.order_by(Product.created_at.desc())
    
    products = query.all()
    
    print(f"📊 Exporting {len(products)} products (start_date={start_date}, end_date={end_date})")
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Product ID',
        'Product Name',
        'Description',
        'Category',
        'SHG / Farmer Name',
        'SHG / Farmer Type',
        'SHG / Farmer Contact Person',
        'SHG / Farmer Mobile',
        'Mandal',
        'Village',
        'View Count',
        'Status',
        'Created Date',
        'Image URL',
        'YouTube Link',
        'Instagram Link'
    ])
    
    # Write data rows
    for product in products:
        category = db.query(Category).filter(Category.id == product.category_id).first()
        shg = db.query(SHG).filter(SHG.id == product.shg_id).first()
        
        writer.writerow([
            product.id,
            product.name,
            product.description,
            category.name if category else '',
            shg.name if shg else '',
            shg.type if shg else '',
            shg.contact_person if shg else '',
            shg.mobile_number if shg else '',
            shg.mandal if shg else '',
            shg.village if shg else '',
            product.view_count,
            'Active' if product.is_active else 'Inactive',
            format_ist_datetime(product.created_at),
            product.image_url or '',
            product.youtube_link or '',
            product.instagram_link or ''
        ])
    
    # Prepare response
    output.seek(0)
    date_range = f"_{start_date}_to_{end_date}" if start_date and end_date else ""
    filename = f"products_export_{dt.now().strftime('%Y%m%d_%H%M%S')}{date_range}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
