/**
 * Centralized API utility with token management and logging
 */
// For production: empty VITE_API_URL means use relative URLs (same origin)
// For development: VITE_API_URL should be 'http://localhost:8003'
const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : 'http://localhost:8003'

export { API_BASE_URL }

// Toast notification system
let toastCallback = null

export const setToastCallback = (callback) => {
  toastCallback = callback
}

export const showToast = (message, type = 'success') => {
  if (toastCallback) {
    toastCallback(message, type)
  } else {
    // Fallback to alert if toast not initialized
    alert(message)
  }
}

// Console logging utility with colors and timestamps
const logger = {
  info: (action, details) => {
    console.log(
      `%c[API] ${new Date().toLocaleTimeString()} ℹ️ ${action}`,
      'color: #3b82f6; font-weight: bold',
      details || ''
    )
  },
  success: (action, data) => {
    console.log(
      `%c[API] ${new Date().toLocaleTimeString()} ✓ ${action}`,
      'color: #10b981; font-weight: bold',
      data || ''
    )
  },
  error: (action, error) => {
    console.error(
      `%c[API] ${new Date().toLocaleTimeString()} ✗ ${action}`,
      'color: #ef4444; font-weight: bold',
      error
    )
  },
  warn: (action, message) => {
    console.warn(
      `%c[API] ${new Date().toLocaleTimeString()} ⚠️ ${action}`,
      'color: #f59e0b; font-weight: bold',
      message
    )
  }
}

// Check if token is expired
const isTokenExpired = (token) => {
  if (!token) return true
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expiryTime = payload.exp * 1000 // Convert to milliseconds
    const now = Date.now()
    const timeLeft = expiryTime - now
    
    if (timeLeft < 0) {
      logger.warn('Token Expired', `Token expired ${Math.abs(timeLeft / 1000)}s ago`)
      return true
    }
    
    if (timeLeft < 60000) { // Less than 1 minute
      logger.warn('Token Expiring Soon', `Token expires in ${Math.floor(timeLeft / 1000)}s`)
    }
    
    return false
  } catch (error) {
    logger.error('Token Parse Error', error)
    return true
  }
}

// Handle logout
const handleLogout = (reason = 'Session expired') => {
  logger.warn('Logout', reason)
  localStorage.removeItem('authToken')
  localStorage.removeItem('user')
  // Redirect to home page (admin pages are hidden, only accessible via direct URL)
  window.location.href = '/'
}

// Main API fetch wrapper
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`
  const method = options.method || 'GET'
  
  logger.info(`${method} Request`, { endpoint, body: options.body })
  
  // Get token
  const token = localStorage.getItem('authToken')
  
  // Check token expiry
  if (token && isTokenExpired(token)) {
    handleLogout('Token expired')
    throw new Error('Session expired. Please login again.')
  }
  
  // Prepare headers
  const headers = {
    ...options.headers,
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  
  try {
    const startTime = performance.now()
    
    const response = await fetch(url, {
      ...options,
      headers
    })
    
    const duration = (performance.now() - startTime).toFixed(2)
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      logger.error(`${method} ${endpoint}`, `401 Unauthorized (${duration}ms)`)
      handleLogout('Authentication failed')
      throw new Error('Unauthorized')
    }
    
    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error(
        `${method} ${endpoint}`,
        `${response.status} ${response.statusText} (${duration}ms)`,
        errorData
      )
      throw new Error(errorData.detail || `Request failed: ${response.statusText}`)
    }
    
    // Parse response
    const data = await response.json().catch(() => null)
    
    logger.success(
      `${method} ${endpoint}`,
      {
        status: response.status,
        duration: `${duration}ms`,
        data: data
      }
    )
    
    return data
  } catch (error) {
    if (error.message !== 'Unauthorized') {
      logger.error(`${method} ${endpoint}`, error.message)
    }
    throw error
  }
}

// Convenience methods
export const api = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint, body, options = {}) => apiFetch(endpoint, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  
  put: (endpoint, body, options = {}) => apiFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  
  delete: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'DELETE' })
}

// Export logger for use in components
export { logger }
