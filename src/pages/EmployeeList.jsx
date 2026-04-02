import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, User, Camera, Printer, Upload, UserCircle } from 'lucide-react'
import { getAllEmployees, getAllPhotoIds } from '../services/dataManager'
import './EmployeeList.css'

export default function EmployeeList() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [photoIds, setPhotoIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [emps, photos] = await Promise.all([
      getAllEmployees(),
      getAllPhotoIds(),
    ])
    setEmployees(emps)
    setPhotoIds(new Set(photos))
    setLoading(false)
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return employees

    const terms = searchQuery.toLowerCase().split(/\s+/)
    return employees.filter((emp) =>
      terms.every((term) => emp.searchText?.includes(term))
    )
  }, [employees, searchQuery])

  if (loading) {
    return (
      <div className="employee-list">
        <div className="loading-state">Loading employees...</div>
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="employee-list">
        <div className="empty-list">
          <Upload size={48} strokeWidth={1} />
          <h3>No employees loaded</h3>
          <p>Import your employee data to get started</p>
          <button className="btn btn-primary" onClick={() => navigate('/import')}>
            <Upload size={16} />
            Import Data
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="employee-list">
      {/* Search Bar */}
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search by name, ID, department, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          autoFocus
        />
        <span className="search-count">
          {filtered.length} of {employees.length}
        </span>
      </div>

      {/* Employee Table */}
      <motion.div
        className="employee-table-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <table className="employee-table">
          <thead>
            <tr>
              <th style={{ width: '44px' }}></th>
              <th>Employee</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>Badge #</th>
              <th style={{ width: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => {
              const hasPhoto = photoIds.has(emp.employeeId)
              return (
                <motion.tr
                  key={emp.employeeId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.2 }}
                  onClick={() => navigate(`/print/${emp.employeeId}`)}
                  className="employee-row"
                >
                  <td>
                    <div className={`photo-indicator ${hasPhoto ? 'has-photo' : ''}`}>
                      {hasPhoto ? <Camera size={14} /> : <UserCircle size={18} />}
                    </div>
                  </td>
                  <td>
                    <div className="employee-name-cell">
                      <span className="emp-name">{emp.fullName || `${emp.firstName} ${emp.lastName}`}</span>
                      <span className="emp-id">{emp.employeeId}</span>
                    </div>
                  </td>
                  <td>
                    {emp.department && (
                      <span className="dept-badge">{emp.department}</span>
                    )}
                  </td>
                  <td className="cell-secondary">{emp.jobTitle}</td>
                  <td className="cell-mono">{emp.badgeNumber}</td>
                  <td>
                    <button
                      className="print-row-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/print/${emp.employeeId}`)
                      }}
                    >
                      <Printer size={14} />
                      Print
                    </button>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </motion.div>

      {filtered.length === 0 && searchQuery && (
        <div className="no-results">
          <Search size={32} strokeWidth={1} />
          <p>No employees match "{searchQuery}"</p>
        </div>
      )}
    </div>
  )
}
