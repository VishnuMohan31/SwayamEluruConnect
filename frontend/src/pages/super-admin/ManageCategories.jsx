import { useState, useEffect } from 'react'
import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import Button from '@components/common/Button'
import CustomSelect from '@components/common/CustomSelect'
import { api, logger, showToast } from '@/utils/api'
import '../admin/Dashboard.css'

const ManageCategories = () => {
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)  // Prevent duplicate submissions
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  // Fetch categories from API
  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      logger.info('Fetching Categories', 'include_inactive=true')
      
      const data = await api.get('/api/categories/?include_inactive=true')
      logger.success('Fetched Categories', `${data.length} categories`)
      
      // Map backend data to frontend format
      const mappedData = data.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        status: cat.is_active ? 'Active' : 'Inactive'
      }))
      setCategories(mappedData)
    } catch (error) {
      logger.error('Fetch Categories Failed', error.message)
      showToast('Failed to load categories', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (submitting) return

    try {
      setSubmitting(true)
      
      const categoryData = {
        name: formData.name,
        description: formData.description
      }
      
      if (editingCategory) {
        logger.info('Updating Category', editingCategory.id)
        const updated = await api.put(`/api/categories/${editingCategory.id}`, categoryData)
        logger.success('Category Updated', updated)
        
        showToast('Category updated successfully!', 'success')
        fetchCategories()
      } else {
        logger.info('Creating Category', formData.name)
        const created = await api.post('/api/categories/', categoryData)
        logger.success('Category Created', created)
        
        showToast('Category added successfully!', 'success')
        fetchCategories()
      }
      
      closeModal()
    } catch (error) {
      logger.error('Save Category Failed', error.message)
      showToast(error.message || 'Failed to save category', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData({
      name: '',
      description: ''
    })
  }

  const handleEdit = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name || '',
      description: category.description || ''
    })
    setShowModal(true)
  }

  const handleDeactivate = async (categoryId) => {
    if (!window.confirm('Are you sure you want to deactivate this category?')) return
    
    try {
      logger.info('Deactivating Category', categoryId)
      await api.put(`/api/categories/${categoryId}/deactivate`)
      logger.success('Category Deactivated', categoryId)
      
      setCategories(categories.map(cat => 
        cat.id === categoryId ? { ...cat, status: 'Inactive' } : cat
      ))
      showToast('Category deactivated successfully!', 'success')
    } catch (error) {
      logger.error('Deactivate Category Failed', error.message)
      showToast('Failed to deactivate category', 'error')
    }
  }

  const handleReactivate = async (categoryId) => {
    if (!window.confirm('Are you sure you want to reactivate this category?')) return
    
    try {
      logger.info('Reactivating Category', categoryId)
      await api.put(`/api/categories/${categoryId}/reactivate`)
      logger.success('Category Reactivated', categoryId)
      
      setCategories(categories.map(cat => 
        cat.id === categoryId ? { ...cat, status: 'Active' } : cat
      ))
      showToast('Category reactivated successfully!', 'success')
    } catch (error) {
      logger.error('Reactivate Category Failed', error.message)
      showToast('Failed to reactivate category', 'error')
    }
  }

  // Filter logic
  const filteredCategories = categories.filter(category => {
    const matchesSearch = 
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = !statusFilter || category.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Manage Categories</h1>
        <Button variant="primary" onClick={() => setShowModal(true)}>+ Add Category</Button>
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
              placeholder="Search by name, ID, or description..."
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

          {/* Status Filter */}
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

          {/* Clear Filters Button */}
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
          <table className="data-table" style={{ minWidth: '800px', width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th style={{ width: '180px' }}>Category Type</th>
                <th>Description</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '110px' }}>Actions</th>
              </tr>
            </thead>
          <tbody>
            {filteredCategories.length > 0 ? (
              filteredCategories.map(category => (
                <tr key={category.id}>
                  <td>{category.id}</td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={category.name}>
                    {category.name}
                  </td>
                  <td 
                    style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      maxWidth: '400px',
                      cursor: category.description && category.description.length > 100 ? 'help' : 'default'
                    }} 
                    title={category.description}
                  >
                    {category.description || '-'}
                  </td>
                  <td>
                    <span className={`status-badge ${category.status.toLowerCase()}`}>
                      {category.status}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="action-icon-btn edit" 
                        title="Edit"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit2 size={16} />
                      </button>
                      {category.status === 'Active' ? (
                        <button 
                          className="action-icon-btn delete" 
                          title="Deactivate"
                          onClick={() => handleDeactivate(category.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button 
                          className="action-icon-btn reactivate" 
                          title="Reactivate"
                          onClick={() => handleReactivate(category.id)}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                  No categories found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add/Edit Category Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal} style={{ paddingTop: '7rem', paddingBottom: '2rem' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Category Name */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Category Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter category name"
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

                {/* Description */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter category description"
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
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingCategory ? 'Update Category' : 'Add Category')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageCategories
