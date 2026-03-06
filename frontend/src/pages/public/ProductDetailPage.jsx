import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FaYoutube, FaInstagram, FaWhatsapp } from 'react-icons/fa'
import Button from '@components/common/Button'
import { useToast } from '@components/common/ToastContainer'
import { API_BASE_URL } from '@utils/api'
import './ProductDetailPage.css'

const ProductDetailPage = () => {
  const { id } = useParams()
  const { showToast } = useToast()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [relatedProducts, setRelatedProducts] = useState([])
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    location: '',
    phone: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`)
      if (!response.ok) throw new Error('Product not found')
      
      const data = await response.json()
      setProduct(data)
      
      // After reordering, main image will always be at index 0
      setSelectedImage(0)
      
      // Fetch related products
      if (data.category_id) {
        fetchRelatedProducts(data.category_id, data.id)
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRelatedProducts = async (categoryId, currentProductId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/?category_id=${categoryId}&limit=4`)
      const data = await response.json()
      setRelatedProducts(data.filter(p => p.id !== currentProductId).slice(0, 3))
    } catch (error) {
      console.error('Failed to fetch related products:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    // Mobile number validation - only allow digits, +, spaces, and hyphens
    if (name === 'phone') {
      const cleanedValue = value.replace(/[^\d+\s-]/g, '')
      setFormData(prev => ({ ...prev, [name]: cleanedValue }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const validatePhoneNumber = (phone) => {
    // Extract only digits
    const digits = phone.replace(/\D/g, '')
    // Check if it's exactly 10 digits
    return digits.length === 10
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate phone number has exactly 10 digits
    if (!validatePhoneNumber(formData.phone)) {
      showToast('Mobile number must be 10 digits', 'error')
      return
    }
    
    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/inquiries/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          name: formData.name,
          email: formData.email || null,
          location: formData.location,
          phone: formData.phone
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to submit inquiry')
      }

      setShowContactModal(false)
      setShowSuccessModal(true)
      setFormData({ name: '', email: '', location: '', phone: '' })
      showToast('Inquiry submitted successfully!', 'success')
    } catch (error) {
      console.error('Failed to submit inquiry:', error)
      showToast(error.message || 'Failed to submit inquiry', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Loading...</div>
  }

  if (!product) {
    return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Product not found</div>
  }

  // Reorder images to show main image first
  const productImages = product.images && product.images.length > 0
    ? product.images.map(url => `${API_BASE_URL}${url}`)
    : product.image_url 
      ? [`${API_BASE_URL}${product.image_url}`]
      : ['/placeholder-product.jpg']

  // Reorder thumbnails: main image first, then others
  const reorderedImages = [...productImages]
  const mainIndex = product.main_image_index || 0
  if (mainIndex > 0 && mainIndex < reorderedImages.length) {
    const mainImage = reorderedImages[mainIndex]
    reorderedImages.splice(mainIndex, 1)
    reorderedImages.unshift(mainImage)
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">›</span>
          <Link to="/products">Products</Link>
          <span className="breadcrumb-separator">›</span>
          <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{product.name}</span>
        </div>

        {/* Product Detail */}
        <div className="product-detail">
          {/* Image Gallery */}
          <div className="product-gallery">
            <div className="main-image">
              <img
                src={reorderedImages[selectedImage]}
                alt={product.name}
                className="gallery-main-img"
              />
            </div>
            {reorderedImages.length > 1 && (
              <div className="thumbnail-list">
                {reorderedImages.map((image, index) => (
                  <button
                    key={index}
                    className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="product-info-section">
            <div className="product-shg-badge">
              <span className="shg-icon">🏛</span>
              <span>{product.shg?.name || 'N/A'} • {product.shg?.village || ''}, {product.shg?.mandal || ''}</span>
            </div>

            <h1 className="product-title">{product.name}</h1>

            {/* Price and Quantity - Redesigned */}
            {(product.price || product.max_quantity) && (
              <div style={{ 
                display: 'flex', 
                gap: '4rem', 
                margin: '2rem 0 1.25rem 0',
                flexWrap: 'wrap'
              }}>
                {product.price && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '1rem 1.5rem',
                    backgroundColor: '#faf8f5',
                    borderLeft: '4px solid var(--color-primary)',
                    borderRadius: '8px'
                  }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-text-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '500'
                    }}>
                      Price
                    </span>
                    <span style={{ 
                      fontSize: '2rem', 
                      fontWeight: '700',
                      color: 'var(--color-primary)',
                      lineHeight: '1'
                    }}>
                      ₹{product.price}
                    </span>
                  </div>
                )}
                {product.max_quantity && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '1rem 1.5rem',
                    backgroundColor: '#faf8f5',
                    borderLeft: '4px solid var(--color-primary)',
                    borderRadius: '8px'
                  }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-text-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '500'
                    }}>
                      Maximum Supply Quantity
                    </span>
                    <span style={{ 
                      fontSize: '2rem', 
                      fontWeight: '700',
                      color: 'var(--color-primary)',
                      lineHeight: '1'
                    }}>
                      {product.max_quantity}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '2rem',
              marginTop: '0'
            }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
                fontSize: '1.125rem',
                flex: '1'
              }}>
                <div>
                  <strong style={{ fontSize: '1.125rem' }}>Category:</strong> {product.category?.name || 'N/A'}
                </div>
                <div>
                  <strong style={{ fontSize: '1.125rem' }}>Farmer:</strong> {product.shg?.name || 'N/A'}
                </div>
              </div>
              
              {/* SHG Person Image */}
              {product.shg?.shg_image && (
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <img 
                    src={`${API_BASE_URL}${product.shg.shg_image}`}
                    alt={product.shg.name}
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      objectFit: 'cover', 
                      borderRadius: '50%',
                      border: '3px solid var(--color-primary)',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <span style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-light)',
                    fontWeight: '500',
                    textAlign: 'center'
                  }}>
                    {product.shg.name}
                  </span>
                </div>
              )}
            </div>

            <div className="product-description">
              <h3>About this Product</h3>
              <p>{product.description}</p>
            </div>

            {(product.youtube_link || product.instagram_link) && (
              <div className="product-social">
                <h4>See More</h4>
                <div className="social-links">
                  {product.youtube_link && (
                    <a href={product.youtube_link} target="_blank" rel="noopener noreferrer" className="social-link social-youtube">
                      <FaYoutube size={24} />
                      <span>Watch Video</span>
                    </a>
                  )}
                  {product.instagram_link && (
                    <a href={product.instagram_link} target="_blank" rel="noopener noreferrer" className="social-link social-instagram">
                      <FaInstagram size={24} />
                      <span>Instagram</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="product-actions">
              <Button
                variant="primary"
                size="large"
                fullWidth
                onClick={() => setShowContactModal(true)}
              >
                📞 Contact
              </Button>
              
              <p className="contact-note">
                Connect directly with the artisan to learn more or place an order
              </p>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="related-products">
            <h2 className="section-title">Related Products</h2>
            <div className="related-grid">
              {relatedProducts.map(relatedProduct => {
                // Get image from new images array or fallback to old image_url
                let imageUrl = '/placeholder-product.jpg'
                if (Array.isArray(relatedProduct.images) && relatedProduct.images.length > 0) {
                  const mainIndex = relatedProduct.main_image_index || 0
                  imageUrl = `${API_BASE_URL}${relatedProduct.images[mainIndex]}`
                } else if (relatedProduct.image_url) {
                  imageUrl = `${API_BASE_URL}${relatedProduct.image_url}`
                }
                
                return (
                  <Link
                    key={relatedProduct.id}
                    to={`/products/${relatedProduct.id}`}
                    className="related-card"
                  >
                    <img 
                      src={imageUrl} 
                      alt={relatedProduct.name} 
                    />
                    <h4>{relatedProduct.name}</h4>
                    <p>{relatedProduct.shg?.name || 'N/A'}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowContactModal(false)}>
              ✕
            </button>
            <h2>Contact Vendor</h2>
            <p>To contact the vendor, please provide your details:</p>
            
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Your name" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  minLength="10"
                  maxLength="10"
                  title="Mobile number must be 10 digits"
                  required 
                />
                {formData.phone && !validatePhoneNumber(formData.phone) && (
                  <small style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Mobile number must be 10 digits
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Location</label>
                <input 
                  type="text" 
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Your city/state" 
                />
              </div>
              <div className="form-group">
                <label>Email (Optional)</label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your@email.com" 
                />
              </div>
              <Button variant="primary" size="large" fullWidth type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit & Get Vendor Details'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSuccessModal(false)}>
              ✕
            </button>
            <h2>✅ Inquiry Submitted!</h2>
            <p>Thank you for your interest. Here are the vendor details:</p>
            
            <div className="vendor-details">
              <div className="detail-item">
                <strong>SHG Name:</strong> {product.shg?.name || 'N/A'}
              </div>
              <div className="detail-item">
                <strong>Contact Person:</strong> {product.shg?.contact_person || 'N/A'}
              </div>
              <div className="detail-item">
                <strong>Mobile:</strong> <a href={`tel:${product.shg?.mobile_number}`}>{product.shg?.mobile_number || 'N/A'}</a>
              </div>
              {product.shg?.whatsapp_number && (
                <div className="detail-item">
                  <strong>WhatsApp:</strong> <a href={`https://wa.me/91${product.shg.whatsapp_number}`} target="_blank" rel="noopener noreferrer">{product.shg.whatsapp_number}</a>
                </div>
              )}
              <div className="detail-item">
                <strong>Location:</strong> {product.shg?.village}, {product.shg?.mandal}
              </div>
            </div>
            
            {/* WhatsApp Contact Button */}
            {product.shg?.whatsapp_number && (
              <a 
                href={`https://wa.me/91${product.shg.whatsapp_number}?text=Hi, I'm interested in ${encodeURIComponent(product.name)}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  marginTop: '1rem',
                  backgroundColor: '#25D366',
                  color: 'white',
                  textAlign: 'center',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#20BA5A'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#25D366'}
              >
                <FaWhatsapp size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Contact on WhatsApp
              </a>
            )}
            
            <Button variant="primary" size="large" fullWidth onClick={() => setShowSuccessModal(false)} style={{ marginTop: '1rem' }}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetailPage
