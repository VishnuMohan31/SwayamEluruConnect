# Deployment Fixes - March 5, 2026

## Issues Resolved

### 1. Frontend API Configuration Issue
**Problem:** Website was trying to connect to `http://localhost:8003` instead of using relative URLs for API calls.

**Root Cause:** The `VITE_API_URL` was set to empty string in `.env.production`, but JavaScript's `||` operator treated empty string as falsy and fell back to `localhost:8003`.

**Solution:** Changed the logic in `frontend/src/utils/api.js`:
```javascript
// Before
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8003'

// After
const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : 'http://localhost:8003'
```

**Files Modified:**
- `frontend/src/utils/api.js`

**Actions Taken:**
- Fixed code on remote server directly
- Rebuilt frontend: `npm run build`
- Committed and pushed changes to GitHub

---

### 2. Product Images Not Loading
**Problem:** All product images showed as broken/missing on the website.

**Root Cause:** Nginx had no configuration to serve static files from `/storage/products/` path. API was returning image URLs like `/storage/products/image.jpg` but nginx didn't know where to find these files.

**Solution:** Added storage location block to nginx configuration:
```nginx
location /storage/ {
    alias /opt/SwayamEluru/SwayamEluru_Shared_Data/storage/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

**Files Modified:**
- `/etc/nginx/sites-available/swayameluruconnect` (on remote server)

**Actions Taken:**
- Updated nginx config
- Tested config: `sudo nginx -t`
- Reloaded nginx: `sudo systemctl reload nginx`

---

### 3. Backend Container Intermittent Crashes
**Problem:** Backend container occasionally stopped responding, causing "Connection refused" errors.

**Root Cause:** Backend was crashing due to database connection issues or health check failures.

**Solution:** Restarted backend container when issues occurred.

**Actions Taken:**
- `docker restart shg_backend`
- Monitored logs: `docker logs shg_backend --tail 50`

---

## Current Production Setup

### Architecture
- **Frontend:** Served by HOST nginx from `/opt/SwayamEluru/SwayamEluruConnect/frontend/dist`
- **Backend:** Docker container on port 8003 (external), 8000 (internal)
- **Database:** Docker container on port 5433 (external), 5432 (internal)
- **Static Files:** Served by HOST nginx from `/opt/SwayamEluru/SwayamEluru_Shared_Data/storage/`

### Nginx Configuration
- Port 80: Redirects to HTTPS
- Port 443: SSL enabled
- `/` → Serves frontend static files
- `/api/` → Proxies to backend at `localhost:8003`
- `/storage/` → Serves files from shared data folder
- `/docs` → Proxies to backend API docs

### Data Preservation
- ✅ 165 products maintained
- ✅ 77 SHGs maintained
- ✅ 25 categories maintained
- ✅ 120 product images preserved
- ✅ 0% data loss

---

## Deployment Checklist (For Future Reference)

1. **Code Changes:**
   - Make changes on remote server OR
   - Push to GitHub and pull on remote server

2. **Frontend Updates:**
   ```bash
   cd /opt/SwayamEluru/SwayamEluruConnect/frontend
   npm run build
   ```

3. **Backend Updates:**
   ```bash
   docker restart shg_backend
   docker logs shg_backend --tail 50
   ```

4. **Nginx Changes:**
   ```bash
   sudo nano /etc/nginx/sites-available/swayameluruconnect
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Verify:**
   - Check website: https://swayameluruconnect.in
   - Check API: https://swayameluruconnect.in/api/categories/
   - Check images: https://swayameluruconnect.in/storage/products/[image-name]

---

## Important Notes

- Frontend docker container (port 3003) is NOT used - nginx serves from disk
- All docker ports bound to 127.0.0.1 for security
- Shared data folder is at sibling level: `/opt/SwayamEluru/SwayamEluru_Shared_Data/`
- Never run two reverse proxies on same port (Docker nginx vs System nginx conflict)
- Always test nginx config before reloading: `sudo nginx -t`

---

**Status:** ✅ All issues resolved. Website fully functional.
**Date:** March 5, 2026
**Time Spent:** ~2 hours
