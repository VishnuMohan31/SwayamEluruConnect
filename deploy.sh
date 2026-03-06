#!/bin/bash

# SwayamEluru Production Deployment Script
# This script automates the entire deployment process

set -e  # Exit on any error

echo "=========================================="
echo "SwayamEluru Production Deployment"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo: sudo ./deploy.sh"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}

echo "Step 1: Creating frontend .env.production..."
cat > frontend/.env.production << 'EOF'
VITE_API_URL=
EOF
chown $ACTUAL_USER:$ACTUAL_USER frontend/.env.production
echo "✓ Frontend .env.production created"
echo ""

echo "Step 2: Installing frontend dependencies..."
cd frontend
npm install
echo "✓ Dependencies installed"
echo ""

echo "Step 3: Building frontend..."
npm run build
echo "✓ Frontend built successfully"
cd ..
echo ""

echo "Step 4: Starting Docker containers..."
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build
echo "✓ Containers started"
echo ""

echo "Step 5: Waiting for services to be healthy..."
sleep 10
echo ""

echo "Step 6: Checking service status..."
docker-compose -f docker-compose.prod.yml ps
echo ""

echo "Step 7: Testing backend health..."
curl -s http://localhost:8003/health | jq '.' || echo "Backend health check"
echo ""

echo "Step 8: Reloading nginx..."
nginx -t && systemctl reload nginx
echo "✓ Nginx reloaded"
echo ""

echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Website: https://swayameluruconnect.in"
echo "  - Backend: http://localhost:8003"
echo "  - Database: localhost:5433"
echo ""
echo "Shared Data: /opt/SwayamEluru/SwayamEluru_Shared_Data/"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
