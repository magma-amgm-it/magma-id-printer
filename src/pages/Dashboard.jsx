import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Camera, Printer, Upload, Clock, ArrowRight } from 'lucide-react'
import { getAllEmployees, getAllPhotoNames, getPrintCountToday, getPrintHistory, getListColumns } from '../services/graphApi'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalEmployees: 0,
    photosUploaded: 0,
    printedToday: 0,
  })
  const [recentPrints, setRecentPrints] = useState([])
  const [lastImport, setLastImport] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      // Debug: log actual SharePoint column names (check console)
      getListColumns('Employee Badges').catch(() => {});

      const [employees, photoNames, printedToday, history] = await Promise.all([
        getAllEmployees(),
        getAllPhotoNames().catch(() => []),
        getPrintCountToday(),
        getPrintHistory(5),
      ])
      setStats({
        totalEmployees: employees.length,
        photosUploaded: photoNames.length,
        printedToday,
      })
      setRecentPrints(history)
      // Last import info from localStorage
      const importInfo = JSON.parse(localStorage.getItem('magma_last_import') || 'null')
      setLastImport(importInfo)
    } catch (err) {
      console.error('Failed to load dashboard stats:', err)
    }
  }

  const kpiCards = [
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'blue',
      onClick: () => navigate('/employees'),
    },
    {
      label: 'Photos Captured',
      value: stats.photosUploaded,
      icon: Camera,
      color: 'purple',
    },
    {
      label: 'Printed Today',
      value: stats.printedToday,
      icon: Printer,
      color: 'green',
    },
  ]

  return (
    <div className="dashboard">
      <div className="kpi-grid">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            className={`kpi-card kpi-${card.color}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={card.onClick}
            style={{ cursor: card.onClick ? 'pointer' : 'default' }}
          >
            <div className="kpi-icon">
              <card.icon size={22} strokeWidth={1.5} />
            </div>
            <div className="kpi-info">
              <span className="kpi-value">{card.value}</span>
              <span className="kpi-label">{card.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="dashboard-grid">
        <motion.div
          className="dashboard-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button className="action-btn action-primary" onClick={() => navigate('/import')}>
              <Upload size={20} />
              <span>Import Employee Data</span>
              <ArrowRight size={16} />
            </button>
            <button className="action-btn action-secondary" onClick={() => navigate('/employees')}>
              <Users size={20} />
              <span>Browse Employees</span>
              <ArrowRight size={16} />
            </button>
            <button className="action-btn action-accent" onClick={() => navigate('/print')}>
              <Printer size={20} />
              <span>Print a Badge</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>

        <motion.div
          className="dashboard-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <h3>Recent Prints</h3>
          {recentPrints.length === 0 ? (
            <div className="empty-state">
              <Clock size={32} strokeWidth={1} />
              <p>No badges printed yet</p>
            </div>
          ) : (
            <div className="print-history">
              {recentPrints.map((record, i) => (
                <div key={record.id || i} className="history-item">
                  <div className="history-icon">
                    <Printer size={14} />
                  </div>
                  <div className="history-info">
                    <span className="history-name">{record.employeeName}</span>
                    <span className="history-date">
                      {new Date(record.printDate).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {lastImport && (
        <div className="import-info">
          Last import: {lastImport.count} employees on{' '}
          {new Date(lastImport.date).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
