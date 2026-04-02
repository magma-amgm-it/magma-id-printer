import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, Check, AlertCircle, ChevronRight, X, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseFile, transformData, getFieldOptions } from '../services/excelParser'
import { saveEmployees } from '../services/dataManager'
import './ImportData.css'

const STEPS = ['Upload File', 'Map Columns', 'Preview & Save']

export default function ImportData() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [parseResult, setParsResult] = useState(null)
  const [columnMapping, setColumnMapping] = useState({})
  const [previewData, setPreviewData] = useState([])
  const [saving, setSaving] = useState(false)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  async function processFile(file) {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ]
    const ext = file.name.split('.').pop().toLowerCase()
    if (!validTypes.includes(file.type) && !['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file.')
      return
    }

    try {
      const result = await parseFile(file)
      setFileInfo({ name: file.name, size: file.size })
      setParsResult(result)
      setColumnMapping(result.columnMapping)
      setStep(1)
      toast.success(`Loaded ${result.rowCount} rows from "${result.sheetName}"`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handleMappingChange(field, value) {
    setColumnMapping((prev) => ({ ...prev, [field]: value }))
  }

  function goToPreview() {
    if (!columnMapping.firstName && !columnMapping.lastName) {
      toast.error('Please map at least FirstName or LastName.')
      return
    }
    const transformed = transformData(parseResult.rawData, columnMapping)
    setPreviewData(transformed)
    setStep(2)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const count = await saveEmployees(previewData)
      toast.success(`Successfully imported ${count} employees!`)
      navigate('/employees')
    } catch (err) {
      toast.error(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="import-page">
      {/* Step indicator */}
      <div className="step-indicator">
        {STEPS.map((label, i) => (
          <div key={label} className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
            <div className="step-circle">
              {i < step ? <Check size={14} /> : <span>{i + 1}</span>}
            </div>
            <span className="step-label">{label}</span>
            {i < STEPS.length - 1 && <ChevronRight size={16} className="step-separator" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 0 && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="step-content"
          >
            <div
              className={`dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon">
                <Upload size={32} strokeWidth={1.5} />
              </div>
              <h3>Drop your employee file here</h3>
              <p>Supports Excel (.xlsx, .xls) and CSV files</p>
              <button className="browse-btn">Browse Files</button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
            <div className="file-hint">
              Expected columns: EmployeeID, FirstName, LastName, Department, JobTitle, BadgeNumber
            </div>
          </motion.div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 1 && parseResult && (
          <motion.div
            key="mapping"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="step-content"
          >
            <div className="mapping-card">
              <div className="mapping-header">
                <FileSpreadsheet size={20} />
                <div>
                  <h3>{fileInfo.name}</h3>
                  <p>{parseResult.rowCount} rows, {parseResult.headers.length} columns</p>
                </div>
              </div>

              <div className="mapping-grid">
                {getFieldOptions().map((field) => (
                  <div key={field} className="mapping-row">
                    <label className="mapping-label">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                      {(field === 'firstName' || field === 'lastName') && (
                        <span className="required">*</span>
                      )}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                      className="mapping-select"
                    >
                      <option value="">-- Not mapped --</option>
                      {parseResult.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {columnMapping[field] && (
                      <span className="mapping-check"><Check size={14} /></span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mapping-actions">
                <button className="btn btn-ghost" onClick={() => setStep(0)}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={goToPreview}>
                  Preview Data
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Preview */}
        {step === 2 && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="step-content"
          >
            <div className="preview-card">
              <div className="preview-header">
                <h3>Preview ({previewData.length} employees)</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                  <X size={14} /> Adjust Mapping
                </button>
              </div>

              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Job Title</th>
                      <th>Badge #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 20).map((emp) => (
                      <tr key={emp.employeeId}>
                        <td className="cell-mono">{emp.employeeId}</td>
                        <td className="cell-bold">{emp.fullName}</td>
                        <td>{emp.department}</td>
                        <td>{emp.jobTitle}</td>
                        <td className="cell-mono">{emp.badgeNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 20 && (
                <p className="preview-note">Showing first 20 of {previewData.length} employees</p>
              )}

              <div className="preview-actions">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : `Import ${previewData.length} Employees`}
                  {!saving && <Check size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
