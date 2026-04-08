import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, User, Camera, Printer, Upload, UserCircle, Trash2, Plus, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAllEmployees, getAllPhotoNames, deleteAllEmployees, deleteEmployee, createEmployee } from '../services/graphApi'
import { getActiveAccount } from '../services/auth'
import './EmployeeList.css'

const ADMIN_EMAIL = 'abhishek.desai@magma-amgm.org'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  department: '',
  jobTitle: '',
  badgeNumber: '',
  email: '',
  phone: '',
}

export default function EmployeeList() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [photoIds, setPhotoIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Add employee modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  const isAdmin = getActiveAccount()?.username?.toLowerCase() === ADMIN_EMAIL

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [emps, photoFileNames] = await Promise.all([
        getAllEmployees(),
        getAllPhotoNames(),
      ])
      setEmployees(emps)
      const ids = photoFileNames.map((name) => name.replace(/\.[^.]+$/, ''))
      setPhotoIds(new Set(ids))
    } catch (err) {
      console.error('Failed to load employees:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteOne(emp, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete ${emp.fullName || emp.firstName}? This will remove them from SharePoint.`)) {
      return
    }
    setDeletingId(emp.id)
    try {
      await deleteEmployee(emp.id)
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id))
      toast.success(`Deleted ${emp.fullName || emp.firstName}`)
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm(`Are you sure you want to delete all ${employees.length} employees from SharePoint? This cannot be undone.`)) {
      return
    }
    setDeleting(true)
    setDeleteProgress({ current: 0, total: employees.length })
    try {
      const { deleted } = await deleteAllEmployees((current, total) => {
        setDeleteProgress({ current, total })
      })
      toast.success(`Deleted ${deleted} employees from SharePoint`)
      setEmployees([])
      setPhotoIds(new Set())
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(false)
      setDeleteProgress(null)
    }
  }

  function handleFormChange(field, value) {
    setAddForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleAddEmployee() {
    if (!addForm.firstName.trim() && !addForm.lastName.trim()) {
      toast.error('Please enter at least a first or last name.')
      return
    }

    setAdding(true)
    try {
      const nextNum = employees.length + 1
      const employeeId = `EMP-${String(nextNum).padStart(4, '0')}`

      await createEmployee({
        employeeId,
        ...addForm,
      })

      toast.success(`Added ${addForm.firstName} ${addForm.lastName}!`)
      setShowAddModal(false)
      setAddForm(EMPTY_FORM)
      loadData()
    } catch (err) {
      toast.error(`Failed to add employee: ${err.message}`)
    } finally {
      setAdding(false)
    }
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
          <p>Import your employee data or add employees manually</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => navigate('/import')}>
              <Upload size={16} />
              Import Data
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              Add Employee
            </button>
          </div>
        </div>

        <AddEmployeeModal
          show={showAddModal}
          form={addForm}
          adding={adding}
          onChange={handleFormChange}
          onSave={handleAddEmployee}
          onClose={() => { setShowAddModal(false); setAddForm(EMPTY_FORM) }}
        />
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
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ marginLeft: 8, whiteSpace: 'nowrap' }}
        >
          <Plus size={14} />
          Add Employee
        </button>
        {isAdmin && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDeleteAll}
            disabled={deleting || employees.length === 0}
            style={{ color: 'var(--accent-danger)', marginLeft: 4, whiteSpace: 'nowrap' }}
            title="Delete all employees from SharePoint (admin only)"
          >
            <Trash2 size={14} />
            {deleting && deleteProgress
              ? `${deleteProgress.current}/${deleteProgress.total}`
              : 'Delete All'}
          </button>
        )}
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
              <th>Staff Type</th>
              <th style={{ width: '140px' }}>Action</th>
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
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
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
                      <button
                        className="delete-row-btn"
                        onClick={(e) => handleDeleteOne(emp, e)}
                        disabled={deletingId === emp.id}
                        title="Delete this employee"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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

      <AddEmployeeModal
        show={showAddModal}
        form={addForm}
        adding={adding}
        onChange={handleFormChange}
        onSave={handleAddEmployee}
        onClose={() => { setShowAddModal(false); setAddForm(EMPTY_FORM) }}
      />
    </div>
  )
}

function AddEmployeeModal({ show, form, adding, onChange, onSave, onClose }) {
  if (!show) return null

  const fields = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'department', label: 'Department' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'badgeNumber', label: 'Badge Number' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 480 }}
        >
          <div className="modal-header">
            <h3>Add Employee</h3>
            <button className="modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">
            <div className="add-form">
              {fields.map(({ key, label, required }) => (
                <div key={key} className="form-field">
                  <label className="form-label">
                    {label}
                    {required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form[key]}
                    onChange={(e) => onChange(key, e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={onSave}
              disabled={adding}
            >
              {adding ? 'Adding...' : (
                <>
                  <Check size={16} />
                  Add Employee
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
