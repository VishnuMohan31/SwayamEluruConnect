import { useState, useEffect } from 'react'
import CustomSelect from '@components/common/CustomSelect'
import { api, logger } from '@/utils/api'
import '../admin/Dashboard.css'

const SuperAdminDashboard = () => {
  const [metricType, setMetricType] = useState('shg') // 'shg' or 'product'
  const [shgTimePeriod, setShgTimePeriod] = useState('30') // For SHG Inquiries
  // Product metrics always use 'all' time period

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSHGs: 0,
    totalContacts: 0,
    totalCategories: 0
  })
  const [topSHGInquiries, setTopSHGInquiries] = useState([])
  const [leastSHGInquiries, setLeastSHGInquiries] = useState([])
  const [topProductInquiries, setTopProductInquiries] = useState([])
  const [leastProductInquiries, setLeastProductInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // Fetch stats from API
  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      logger.info('Fetching Dashboard Stats', 'analytics/stats')
      
      const data = await api.get('/api/analytics/stats')
      logger.success('Fetched Dashboard Stats', data)
      
      setStats({
        totalProducts: data.totalProducts || 0,
        totalSHGs: data.totalSHGs || 0,
        totalContacts: data.totalContacts || 0,
        totalCategories: data.totalCategories || 0
      })
    } catch (error) {
      logger.error('Fetch Dashboard Stats Failed', error.message)
      setStats({
        totalProducts: 0,
        totalSHGs: 0,
        totalContacts: 0,
        totalCategories: 0
      })
    } finally {
      setStatsLoading(false)
    }
  }

  // Fetch metrics data from API
  useEffect(() => {
    fetchMetricsData()
  }, [metricType, shgTimePeriod])

  const fetchMetricsData = async () => {
    try {
      setLoading(true)
      logger.info('Fetching Dashboard Metrics', `type=${metricType}, period=${shgTimePeriod}`)
      
      const data = await api.get(`/api/analytics/metrics?type=${metricType}&period=${shgTimePeriod}`)
      logger.success('Fetched Dashboard Metrics', data)
      
      setTopSHGInquiries(data.topSHGs || [])
      setLeastSHGInquiries(data.leastSHGs || [])
      setTopProductInquiries(data.topProducts || [])
      setLeastProductInquiries(data.leastProducts || [])
    } catch (error) {
      logger.error('Fetch Dashboard Metrics Failed', error.message)
      setTopSHGInquiries([])
      setLeastSHGInquiries([])
      setTopProductInquiries([])
      setLeastProductInquiries([])
    } finally {
      setLoading(false)
    }
  }

  const renderListItem = (item, index, isProduct = false, isLeast = false) => {
    // For product metrics, show product count; for SHG metrics, show inquiry count
    const count = item.inquiries || 0
    const label = metricType === 'product' ? (count === 1 ? 'product' : 'products') : (count === 1 ? 'inquiry' : 'inquiries')
    
    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--color-background)',
          borderRadius: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ 
            fontWeight: '700', 
            fontSize: '1.25rem', 
            color: !isLeast && index < 3 ? 'var(--color-primary)' : 'var(--color-text-light)',
            minWidth: '30px'
          }}>
            {index + 1}
          </span>
          <div>
            <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{item.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
              {item.district && item.state ? `${item.district}, ${item.state}` : (item.state || item.district || 'N/A')}
            </div>
          </div>
        </div>
        <div>
          <span style={{ 
            fontWeight: '600', 
            fontSize: '0.875rem',
            color: isLeast ? '#DC2626' : 'inherit'
          }}>
            {count} {label}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Super Admin Dashboard</h1>
        <p>Manage content and products</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#ffffff', fontFamily: 'inherit', fontWeight: '500' }}>
              {statsLoading ? '...' : stats.totalProducts}
            </div>
            <div className="stat-label" style={{ color: '#ffffff' }}>Total Products</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏛</div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#ffffff', fontFamily: 'inherit', fontWeight: '500' }}>
              {statsLoading ? '...' : stats.totalSHGs}
            </div>
            <div className="stat-label" style={{ color: '#ffffff' }}>SHGs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📂</div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#ffffff', fontFamily: 'inherit', fontWeight: '500' }}>
              {statsLoading ? '...' : stats.totalCategories}
            </div>
            <div className="stat-label" style={{ color: '#ffffff' }}>No. of Categories</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📞</div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: '#ffffff', fontFamily: 'inherit', fontWeight: '500' }}>
              {statsLoading ? '...' : stats.totalContacts}
            </div>
            <div className="stat-label" style={{ color: '#ffffff' }}>No. of Inquiries</div>
          </div>
        </div>
      </div>

      {/* Performance Metrics Section */}
      <div className="dashboard-card">
        <div className="metrics-header" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>📊 Performance Metrics</h3>
          <div className="metrics-controls">
            {/* Metric Type Toggle - SHG or Product */}
            <div className="metrics-toggle" style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-background)', padding: '0.25rem', borderRadius: '8px' }}>
              <button
                onClick={() => setMetricType('shg')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backgroundColor: metricType === 'shg' ? 'var(--color-primary)' : 'transparent',
                  color: metricType === 'shg' ? 'white' : 'var(--color-text)',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                🏛 SHG Inquiries
              </button>
              <button
                onClick={() => setMetricType('product')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backgroundColor: metricType === 'product' ? 'var(--color-primary)' : 'transparent',
                  color: metricType === 'product' ? 'white' : 'var(--color-text)',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                📦 Number of Products
              </button>
            </div>

            {/* Time Period Filter - below toggle */}
            <div className="metrics-dropdown" style={{ minWidth: '160px' }}>
              {metricType === 'shg' ? (
                <CustomSelect
                  value={shgTimePeriod}
                  onChange={(e) => setShgTimePeriod(e.target.value)}
                  options={[
                    { value: '7', label: 'Last 7 Days' },
                    { value: '30', label: 'Last 30 Days' },
                    { value: '90', label: 'Last 90 Days' },
                    { value: 'all', label: 'All Time' }
                  ]}
                  placeholder="Select Period"
                />
              ) : (
                <CustomSelect
                  value="all"
                  onChange={() => {}}
                  options={[
                    { value: 'all', label: 'All Time' }
                  ]}
                  placeholder="All Time"
                  className="disabled"
                />
              )}
            </div>
          </div>
        </div>

        {/* Side by Side Layout - Top 10 and Least 10 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Top 10 Column */}
          <div>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔥 Top 10 {metricType === 'shg' ? 'SHGs' : 'Products'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                  Loading...
                </div>
              ) : (metricType === 'shg' ? topSHGInquiries : topProductInquiries).length > 0 ? (
                metricType === 'shg' 
                  ? topSHGInquiries.map((shg, index) => renderListItem(shg, index, false, false))
                  : topProductInquiries.map((product, index) => renderListItem(product, index, true, false))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Least 10 Column */}
          <div>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📉 Least 10 {metricType === 'shg' ? 'SHGs' : 'Products'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                  Loading...
                </div>
              ) : (metricType === 'shg' ? leastSHGInquiries : leastProductInquiries).length > 0 ? (
                metricType === 'shg' 
                  ? leastSHGInquiries.map((shg, index) => renderListItem(shg, index, false, true))
                  : leastProductInquiries.map((product, index) => renderListItem(product, index, true, true))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminDashboard
