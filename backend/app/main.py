"""
Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .config import settings
from .database import engine, Base
from .api import auth, products, categories, shgs, inquiries, users, analytics, reports, locations
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(settings.LOG_FILE),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Create database tables
# DISABLED: Tables are created by init scripts or restored from backup
# Base.metadata.create_all(bind=engine)

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="A government-supported platform for promoting tribal products",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Configure CORS
if settings.DEBUG:
    # Development: Allow all origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Production: Specific origins with credentials
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Middleware to fix redirect URLs to use HTTPS (PRODUCTION ONLY)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        
        # If it's a redirect response, ensure it uses HTTPS
        if response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get("location", "")
            if location.startswith("http://"):
                # Get the forwarded proto from nginx
                forwarded_proto = request.headers.get("x-forwarded-proto", "https")
                if forwarded_proto == "https":
                    # Replace http:// with https://
                    new_location = location.replace("http://", "https://", 1)
                    response.headers["location"] = new_location
        
        return response

# Only add HTTPS redirect middleware in production
if not settings.DEBUG:
    app.add_middleware(HTTPSRedirectMiddleware)


@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    from pathlib import Path
    
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Ensure storage directories exist
    try:
        storage_base = Path(settings.STORAGE_PATH)
        (storage_base / "products").mkdir(parents=True, exist_ok=True)
        (storage_base / "temp").mkdir(parents=True, exist_ok=True)
        logger.info(f"Storage directories initialized at: {storage_base.absolute()}")
    except Exception as e:
        logger.error(f"Failed to create storage directories: {str(e)}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info(f"Shutting down {settings.APP_NAME}")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to Swayam Eluru Market Place API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else "Documentation disabled in production"
    }


@app.get("/favicon.ico")
async def favicon():
    """Favicon endpoint to prevent 404 errors."""
    return JSONResponse(status_code=204, content=None)


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    Returns application status and database connectivity.
    """
    from datetime import datetime
    from sqlalchemy import text
    
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = "disconnected"
    
    return JSONResponse(
        status_code=200 if db_status == "connected" else 503,
        content={
            "status": "healthy" if db_status == "connected" else "unhealthy",
            "database": db_status,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )


# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(shgs.router, prefix="/api/shgs", tags=["SHGs"])
app.include_router(inquiries.router, prefix="/api/inquiries", tags=["Inquiries"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])

# Mount static files for serving uploaded images
storage_path = Path(settings.STORAGE_PATH)
if storage_path.exists():
    app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")
    logger.info(f"Static files mounted at /storage -> {storage_path.absolute()}")
else:
    logger.warning(f"Storage path does not exist: {storage_path.absolute()}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

