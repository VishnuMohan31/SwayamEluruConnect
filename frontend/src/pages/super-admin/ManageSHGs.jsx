import { useState, useEffect } from 'react'
import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import Button from '@components/common/Button'
import CustomSelect from '@components/common/CustomSelect'
import { api, logger, showToast } from '@/utils/api'
import '../admin/Dashboard.css'

const ManageSHGs = () => {
  const [showModal, setShowModal] = useState(false)
  const [editingSHG, setEditingSHG] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [shgs, setSHGs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)  // Prevent duplicate submissions
  
  // Location dropdowns state
  const [mandals, setMandals] = useState([])
  const [villages, setVillages] = useState([])
  const [loadingMandals, setLoadingMandals] = useState(false)
  const [loadingVillages, setLoadingVillages] = useState(false)
  
  const [formData, setFormData] = useState({
    type: 'SHG',
    name: '',
    contactPerson: '',
    mobileNumber: '',
    whatsappNumber: '',
    sameAsMobile: false,  // Checkbox state
    mandal: '',
    village: '',
    status: 'Active',
    description: '',
    photo: null,
    photoPreview: null
  })

  // Fetch SHGs from API
  useEffect(() => {
    fetchSHGs()
  }, [])

  // Fetch mandals when modal opens
  useEffect(() => {
    if (showModal) {
      fetchMandals()
    }
  }, [showModal])

  // Fetch villages when mandal changes
  useEffect(() => {
    if (formData.mandal) {
      fetchVillages(formData.mandal)
    } else {
      setVillages([])
      setFormData(prev => ({ ...prev, village: '' }))
    }
  }, [formData.mandal])

  const fetchMandals = async () => {
    try {
      setLoadingMandals(true)
      logger.info('Fetching Mandals', 'from locations API')
      const data = await api.get('/api/locations/mandals')
      setMandals(data.mandals || [])
      logger.success('Fetched Mandals', `${data.mandals?.length || 0} mandals`)
    } catch (error) {
      logger.error('Fetch Mandals Failed', error.message)
      showToast('Failed to load mandals', 'error')
      setMandals([])
    } finally {
      setLoadingMandals(false)
    }
  }

  const fetchVillages = async (mandal) => {
    try {
      setLoadingVillages(true)
      logger.info('Fetching Villages', `for mandal: ${mandal}`)
      const data = await api.get(`/api/locations/villages?mandal=${encodeURIComponent(mandal)}`)
      setVillages(data.villages || [])
      logger.success('Fetched Villages', `${data.villages?.length || 0} villages`)
    } catch (error) {
      logger.error('Fetch Villages Failed', error.message)
      showToast('Failed to load villages', 'error')
      setVillages([])
    } finally {
      setLoadingVillages(false)
    }
  }

  const fetchSHGs = async () => {
    try {
      setLoading(true)
      logger.info('Fetching SHGs', 'include_inactive=true')
      
      const data = await api.get('/api/shgs/?include_inactive=true')
      logger.success('Fetched SHGs', `${data.length} records`)
      
      // Map backend data to frontend format
      const mappedData = data.map(shg => ({
        id: shg.id,
        type: shg.type || 'SHG',
        name: shg.name,
        contactPerson: shg.contact_person,
        mobileNumber: shg.mobile_number,
        whatsappNumber: shg.whatsapp_number || '',
        mandal: shg.mandal,
        village: shg.village,
        description: shg.description || '',
        shgImage: shg.shg_image || null,
        status: shg.is_active ? 'Active' : 'Inactive'
      }))
      setSHGs(mappedData)
    } catch (error) {
      logger.error('Fetch SHGs Failed', error.message)
      showToast('Failed to load SHGs', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Filter logic (treat missing status as 'Active' so filters work with existing data)
  const filteredSHGs = shgs.filter(shg => {
    const search = (searchQuery || '').trim().toLowerCase()
    const matchesSearch = !search ||
      (shg.name && shg.name.toLowerCase().includes(search)) ||
      (shg.id && shg.id.toLowerCase().includes(search)) ||
      (shg.contactPerson && shg.contactPerson.toLowerCase().includes(search)) ||
      (shg.mobileNumber && shg.mobileNumber.includes(search)) ||
      (shg.mandal && shg.mandal.toLowerCase().includes(search)) ||
      (shg.village && shg.village.toLowerCase().includes(search))
    const effectiveStatus = shg.status || 'Active'
    const matchesStatus = !statusFilter || effectiveStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    // Handle checkbox for "same as mobile"
    if (name === 'sameAsMobile') {
      setFormData(prev => ({
        ...prev,
        sameAsMobile: checked,
        whatsappNumber: checked ? prev.mobileNumber : ''
      }))
      return
    }
    
    // Mobile number validation
    if (name === 'mobileNumber') {
      const cleanedValue = value.replace(/[^\d+\s-]/g, '')
      setFormData(prev => ({
        ...prev,
        mobileNumber: cleanedValue,
        // Auto-update WhatsApp if checkbox is checked
        whatsappNumber: prev.sameAsMobile ? cleanedValue : prev.whatsappNumber
      }))
    } else if (name === 'whatsappNumber') {
      const cleanedValue = value.replace(/[^\d+\s-]/g, '')
      setFormData(prev => ({ ...prev, whatsappNumber: cleanedValue }))
    } else if (name === 'mandal') {
      // When mandal changes, reset village
      setFormData(prev => ({ ...prev, mandal: value, village: '' }))
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error')
        return
      }
      // Validate file size (max 2MB for SHG photos)
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image size should be within 2MB', 'error')
        return
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          photo: file,
          photoPreview: reader.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (submitting) return

    // Validate phone number has exactly 10 digits
    if (!validatePhoneNumber(formData.mobileNumber)) {
      showToast('Mobile number must be 10 digits', 'error')
      return
    }

    try {
      setSubmitting(true)
      
      let shgImageUrl = formData.photoPreview

      // Upload photo if new file selected
      if (formData.photo) {
        logger.info('Uploading SHG Photo', formData.photo.name)
        const photoFormData = new FormData()
        photoFormData.append('file', formData.photo)
        
        const uploadData = await api.post('/api/shgs/upload-image', photoFormData)
        shgImageUrl = uploadData.image_url
        logger.success('Photo Uploaded', shgImageUrl)
      } else if (shgImageUrl && shgImageUrl.startsWith('http')) {
        // Strip API_BASE_URL from existing image URL to get relative path
        const API_BASE_URL = import.meta.env.VITE_API_URL || ''
        shgImageUrl = shgImageUrl.replace(API_BASE_URL, '')
      }

      const shgData = {
        type: 'SHG',
        name: formData.name,
        contact_person: formData.contactPerson,
        mobile_number: formData.mobileNumber,
        whatsapp_number: formData.whatsappNumber || null,
        mandal: formData.mandal,
        village: formData.village,
        description: formData.description,
        shg_image: shgImageUrl || null
        // state and district will be auto-filled by backend from logged-in super admin
      }
      
      if (editingSHG) {
        // Update existing SHG
        logger.info('Updating SHG', editingSHG.id)
        const updated = await api.put(`/api/shgs/${editingSHG.id}`, shgData)
        logger.success('SHG Updated', updated)
        
        showToast('SHG updated successfully!', 'success')
        fetchSHGs()
      } else {
        // Add new SHG
        logger.info('Creating SHG', formData.name)
        const created = await api.post('/api/shgs/', shgData)
        logger.success('SHG Created', created)
        
        showToast('SHG added successfully!', 'success')
        fetchSHGs()
      }
      
      closeModal()
    } catch (error) {
      logger.error('Save SHG Failed', error.message)
      showToast('Failed to save SHG', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSHG(null)
    setMandals([])
    setVillages([])
    setFormData({
      type: 'SHG',
      name: '',
      contactPerson: '',
      mobileNumber: '',
      whatsappNumber: '',
      sameAsMobile: false,
      mandal: '',
      village: '',
      status: 'Active',
      description: '',
      photo: null,
      photoPreview: null
    })
  }

  const handleEdit = (shg) => {
    setEditingSHG(shg)
    const sameNumber = shg.whatsappNumber === shg.mobileNumber
    const API_BASE_URL = import.meta.env.VITE_API_URL || ''
    setFormData({
      type: 'SHG',
      name: shg.name || '',
      contactPerson: shg.contactPerson || '',
      mobileNumber: shg.mobileNumber || '',
      whatsappNumber: shg.whatsappNumber || '',
      sameAsMobile: sameNumber,
      mandal: shg.mandal || '',
      village: shg.village || '',
      status: shg.status || 'Active',
      description: shg.description || '',
      photo: null,
      photoPreview: shg.shgImage ? `${API_BASE_URL}${shg.shgImage}` : null
    })
    setShowModal(true)
  }

  const handleAddSHG = () => {
    setShowModal(true)
  }

  const handleDeactivate = async (shgId) => {
    if (!window.confirm('Are you sure you want to deactivate this SHG?')) return
    
    try {
      logger.info('Deactivating SHG', shgId)
      await api.put(`/api/shgs/${shgId}/deactivate`)
      logger.success('SHG Deactivated', shgId)
      
      setSHGs(prev => prev.map(shg => 
        shg.id === shgId ? { ...shg, status: 'Inactive' } : shg
      ))
      showToast('SHG deactivated successfully!', 'success')
    } catch (error) {
      logger.error('Deactivate SHG Failed', error.message)
      showToast('Failed to deactivate SHG', 'error')
    }
  }

  const handleReactivate = async (shgId) => {
    if (!window.confirm('Are you sure you want to reactivate this SHG?')) return
    
    try {
      logger.info('Reactivating SHG', shgId)
      await api.put(`/api/shgs/${shgId}/reactivate`)
      logger.success('SHG Reactivated', shgId)
      
      setSHGs(prev => prev.map(shg => 
        shg.id === shgId ? { ...shg, status: 'Active' } : shg
      ))
      showToast('SHG reactivated successfully!', 'success')
    } catch (error) {
      logger.error('Reactivate SHG Failed', error.message)
      showToast('Failed to reactivate SHG', 'error')
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Manage SHGs</h1>
        <Button variant="primary" onClick={handleAddSHG}>
          + Add SHG
        </Button>
      </div>

      {/* Filters Section */}
      <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'end' }}>
          {/* Search - Takes remaining space */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search by ID, Name, Contact Person, Mobile, Mandal, or Village..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '2px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Status Filter - Fixed width */}
          <div style={{ minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Status
            </label>
            <CustomSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              placeholder="All Status"
            />
          </div>

          {/* Clear Filters Button - Auto width */}
          <Button 
            variant="outline" 
            onClick={clearFilters}
            style={{ height: '42px', whiteSpace: 'nowrap' }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-table-wrapper">
          <table className="data-table" style={{ minWidth: '1100px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th style={{ width: '80px' }}>Photo</th>
                <th style={{ width: '160px' }}>Name</th>
                <th style={{ width: '140px' }}>Contact Person</th>
                <th style={{ width: '120px' }}>Mobile Number</th>
                <th style={{ width: '110px' }}>Mandal</th>
                <th style={{ width: '110px' }}>Village</th>
                <th style={{ width: '90px' }}>Status</th>
                <th style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSHGs.length > 0 ? (
                filteredSHGs.map(shg => (
                  <tr key={shg.id}>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shg.id}</td>
                    <td>
                      {shg.shgImage ? (
                        <img 
                          src={`${import.meta.env.VITE_API_URL || ''}${shg.shgImage}`}
                          alt={shg.name}
                          style={{ 
                            width: '50px', 
                            height: '50px', 
                            objectFit: 'cover', 
                            borderRadius: '8px',
                            border: '2px solid var(--color-border)'
                          }}
                        />
                      ) : (
                        <div style={{ 
                          width: '50px', 
                          height: '50px', 
                          backgroundColor: 'var(--color-overlay)', 
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-light)'
                        }}>
                          No Photo
                        </div>
                      )}
                    </td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shg.name}>{shg.name || '-'}</td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shg.contactPerson}>{shg.contactPerson || '-'}</td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shg.mobileNumber || '-'}</td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shg.mandal}>{shg.mandal || '-'}</td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shg.village}>{shg.village || '-'}</td>
                    <td>
                      <span className={`status-badge ${(shg.status || 'Active').toLowerCase()}`}>
                        {shg.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          className="action-icon-btn edit" 
                          title="Edit"
                          onClick={() => handleEdit(shg)}
                        >
                          <Edit2 size={18} />
                        </button>
                        {(shg.status || 'Active') === 'Active' ? (
                          <button 
                            className="action-icon-btn delete" 
                            title="Deactivate"
                            onClick={() => handleDeactivate(shg.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        ) : (
                          <button 
                            className="action-icon-btn reactivate" 
                            title="Reactivate"
                            onClick={() => handleReactivate(shg.id)}
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                    No SHGs found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit SHG Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal} style={{ paddingTop: '7rem', paddingBottom: '2rem' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', margin: '2rem auto' }}>
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>
                {editingSHG ? 'Edit SHG' : 'Add New SHG'}
              </h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* SHG Name */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    SHG Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter SHG name"
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '2px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                {/* Mandal */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Mandal <span style={{ color: 'red' }}>*</span>
                  </label>
                  <CustomSelect
                    name="mandal"
                    value={formData.mandal}
                    onChange={handleInputChange}
                    required
                    disabled={loadingMandals}
                    options={[
                      { value: '', label: loadingMandals ? 'Loading mandals...' : 'Select mandal' },
                      ...mandals.map(mandal => ({ value: mandal, label: mandal }))
                    ]}
                    placeholder="Select mandal"
                  />
                </div>

                {/* Village */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Village <span style={{ color: 'red' }}>*</span>
                  </label>
                  <CustomSelect
                    name="village"
                    value={formData.village}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.mandal || loadingVillages}
                    options={[
                      { 
                        value: '', 
                        label: !formData.mandal 
                          ? 'Select mandal first' 
                          : loadingVillages 
                          ? 'Loading villages...' 
                          : 'Select village'
                      },
                      ...villages.map(village => ({ value: village.village, label: village.village }))
                    ]}
                    placeholder="Select village"
                  />
                </div>

                {/* Contact Person */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Contact Person <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleInputChange}
                    placeholder="Enter contact person name"
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '2px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                {/* Mobile Number */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Mobile Number <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    placeholder="Enter mobile number"
                    minLength="10"
                    maxLength="10"
                    title="Mobile number must be 10 digits"
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '2px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />
                  {formData.mobileNumber && !validatePhoneNumber(formData.mobileNumber) && (
                    <small style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      Mobile number must be 10 digits
                    </small>
                  )}
                </div>

                {/* WhatsApp Same as Mobile Checkbox */}
                <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      name="sameAsMobile"
                      checked={formData.sameAsMobile}
                      onChange={handleInputChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>WhatsApp number is same as mobile number</span>
                  </label>
                </div>

                {/* WhatsApp Number */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    name="whatsappNumber"
                    value={formData.whatsappNumber}
                    onChange={handleInputChange}
                    placeholder="Enter WhatsApp number"
                    minLength="10"
                    maxLength="10"
                    title="WhatsApp number must be 10 digits"
                    disabled={formData.sameAsMobile}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '2px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: formData.sameAsMobile ? '#f3f4f6' : 'white',
                      cursor: formData.sameAsMobile ? 'not-allowed' : 'text'
                    }}
                  />
                  {formData.whatsappNumber && !validatePhoneNumber(formData.whatsappNumber) && !formData.sameAsMobile && (
                    <small style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      WhatsApp number must be 10 digits
                    </small>
                  )}
                </div>

                {/* Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter SHG description"
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '2px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* SHG/Contact Person Photo */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    SHG/Contact Person Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '2px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />
                  {formData.photoPreview && (
                    <div style={{ marginTop: '1rem' }}>
                      <img 
                        src={formData.photoPreview} 
                        alt="Preview" 
                        style={{ 
                          width: '120px', 
                          height: '120px', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '2px solid var(--color-border)'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingSHG ? 'Update SHG' : 'Add SHG')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageSHGs
