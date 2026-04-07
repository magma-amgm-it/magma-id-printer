import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Camera, Printer, UserCircle, Trash2, Plus, X, Check, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAllClients, getAllPhotoNames, deleteAllClients, createClient } from '../services/graphApi'
import './EmployeeList.css'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  program: '',
  startDate: '',
}

export default function ClientList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [photoIds, setPhotoIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(null)

  // Add client modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [cls, photoFileNames] = await Promise.all([
        getAllClients(),
        getAllPhotoNames('Client Photos'),
      ])
      setClients(cls)
      const ids = photoFileNames.map((name) => name.replace(/\.[^.]+$/, ''))
      setPhotoIds(new Set(ids))
    } catch (err) {
      console.error('Failed to load clients:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm(`Are you sure you want to delete all ${clients.length} clients from SharePoint? This cannot be undone.`)) {
      return
    }
    setDeleting(true)
    setDeleteProgress({ current: 0, total: clients.length })
    try {
      const { deleted } = await deleteAllClients((current, total) => {
        setDeleteProgress({ current, total })
      })
      toast.success(`Deleted ${deleted} clients from SharePoint`)
      setClients([])
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

  async function handleAddClient() {
    if (!addForm.firstName.trim() && !addForm.lastName.trim()) {
      toast.error('Please enter at least a first or last name.')
      return
    }

    setAdding(true)
    try {
      const nextNum = clients.length + 1
      const clientId = `CLT-${String(nextNum).padStart(4, '0')}`

      await createClient({
        clientId,
        ...addForm,
      })

      toast.success(`Added ${addForm.firstName} ${addForm.lastName}!`)
      setShowAddModal(false)
      setAddForm(EMPTY_FORM)
      loadData()
    } catch (err) {
      toast.error(`Failed to add client: ${err.message}`)
    } finally {
      setAdding(false)
    }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return clients

    const terms = searchQuery.toLowerCase().split(/\s+/)
    return clients.filter((c) =>
      terms.every((term) => c.searchText?.includes(term))
    )
  }, [clients, searchQuery])

  if (loading) {
    return (
      <div className="employee-list">
        <div className="loading-state">Loading clients...</div>
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="employee-list">
        <div className="empty-list">
          <GraduationCap size={48} strokeWidth={1} />
          <h3>No clients yet</h3>
          <p>Add language school clients to create their ID cards</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Client
          </button>
        </div>

        <AddClientModal
          show={showAddModal}
          form={addForm}
          adding={adding}
          onChange={handleFormChange}
          onSave={handleAddClient}
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
          placeholder="Search by name, program, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          autoFocus
        />
        <span className="search-count">
          {filtered.length} of {clients.length}
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ marginLeft: 8, whiteSpace: 'nowrap' }}
        >
          <Plus size={14} />
          Add Client
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleDeleteAll}
          disabled={deleting || clients.length === 0}
          style={{ color: 'var(--accent-danger)', marginLeft: 4, whiteSpace: 'nowrap' }}
          title="Delete all clients from SharePoint"
        >
          <Trash2 size={14} />
          {deleting && deleteProgress
            ? `${deleteProgress.current}/${deleteProgress.total}`
            : 'Delete All'}
        </button>
      </div>

      {/* Client Table */}
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
              <th>Client</th>
              <th>Program</th>
              <th>Email</th>
              <th>Start Date</th>
              <th style={{ width: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client, i) => {
              const hasPhoto = photoIds.has(client.clientId)
              return (
                <motion.tr
                  key={client.clientId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.2 }}
                  onClick={() => navigate(`/print-client/${client.clientId}`)}
                  className="employee-row"
                >
                  <td>
                    <div className={`photo-indicator ${hasPhoto ? 'has-photo' : ''}`}>
                      {hasPhoto ? <Camera size={14} /> : <UserCircle size={18} />}
                    </div>
                  </td>
                  <td>
                    <div className="employee-name-cell">
                      <span className="emp-name">{client.fullName}</span>
                      <span className="emp-id">{client.clientId}</span>
                    </div>
                  </td>
                  <td>
                    {client.program && (
                      <span className="dept-badge">{client.program}</span>
                    )}
                  </td>
                  <td className="cell-secondary">{client.email}</td>
                  <td className="cell-mono">
                    {client.startDate ? new Date(client.startDate).toLocaleDateString() : ''}
                  </td>
                  <td>
                    <button
                      className="print-row-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/print-client/${client.clientId}`)
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
          <p>No clients match "{searchQuery}"</p>
        </div>
      )}

      <AddClientModal
        show={showAddModal}
        form={addForm}
        adding={adding}
        onChange={handleFormChange}
        onSave={handleAddClient}
        onClose={() => { setShowAddModal(false); setAddForm(EMPTY_FORM) }}
      />
    </div>
  )
}

function AddClientModal({ show, form, adding, onChange, onSave, onClose }) {
  if (!show) return null

  const fields = [
    { key: 'firstName', label: 'First Name', required: true, type: 'text' },
    { key: 'lastName', label: 'Last Name', required: true, type: 'text' },
    { key: 'program', label: 'Program', type: 'text' },
    { key: 'startDate', label: 'Expiry Date', type: 'date' },
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
            <h3>Add Client</h3>
            <button className="modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">
            <div className="add-form">
              {fields.map(({ key, label, required, type }) => (
                <div key={key} className="form-field">
                  <label className="form-label">
                    {label}
                    {required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
                  </label>
                  <input
                    type={type}
                    className="form-input"
                    value={form[key]}
                    onChange={(e) => onChange(key, e.target.value)}
                    placeholder={type === 'date' ? '' : `Enter ${label.toLowerCase()}`}
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
                  Add Client
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
