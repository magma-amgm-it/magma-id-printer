import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, RotateCcw, Printer, Search, Check,
  AlertCircle, ChevronDown, X, User
} from 'lucide-react'
import Webcam from 'react-webcam'
import toast from 'react-hot-toast'
import {
  getEmployee, getAllEmployees, uploadPhoto, downloadPhoto,
  addPrintRecord, updateEmployee
} from '../services/graphApi'
import { getActiveAccount } from '../services/auth'
import { blobToDataUrl, printBadge } from '../services/printService'
import './PrintBadge.css'

export default function PrintBadge() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const webcamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [employee, setEmployee] = useState(null)
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamReady, setWebcamReady] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(!employeeId)

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [template, setTemplate] = useState('premium') // 'premium', 'branded', or 'clean'

  useEffect(() => {
    if (employeeId) {
      loadEmployee(employeeId)
    }
  }, [employeeId])

  async function loadEmployee(id) {
    try {
      const emp = await getEmployee(id)
      if (emp) {
        setEmployee(emp)
        setShowSearch(false)

        // Load existing photo from SharePoint
        const url = await downloadPhoto(id)
        setPhotoDataUrl(url)
      }
    } catch (err) {
      console.error('Failed to load employee:', err)
      toast.error('Failed to load employee data')
    }
  }

  async function handleSearch(query) {
    setSearchQuery(query)
    if (query.trim().length >= 1) {
      try {
        const allEmployees = await getAllEmployees()
        const terms = query.toLowerCase().split(/\s+/)
        const results = allEmployees.filter((emp) =>
          terms.every((term) => emp.searchText?.includes(term))
        )
        setSearchResults(results.slice(0, 10))
      } catch (err) {
        console.error('Search failed:', err)
      }
    } else {
      setSearchResults([])
    }
  }

  function selectEmployee(emp) {
    navigate(`/print/${emp.employeeId}`, { replace: true })
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  // Webcam capture
  const capturePhoto = useCallback(async () => {
    if (!webcamRef.current) return

    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) return

    // Convert data URL to blob
    const res = await fetch(imageSrc)
    const blob = await res.blob()

    // Upload to SharePoint
    try {
      await uploadPhoto(employee.employeeId, blob)
      setPhotoDataUrl(imageSrc)
      setShowWebcam(false)
      toast.success('Photo captured and uploaded!')
    } catch (err) {
      console.error('Photo upload failed:', err)
      toast.error('Failed to upload photo')
    }
  }, [employee])

  // File upload
  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result

      // Convert to blob for upload to SharePoint
      const res = await fetch(dataUrl)
      const blob = await res.blob()

      try {
        await uploadPhoto(employee.employeeId, blob)
        setPhotoDataUrl(dataUrl)
        toast.success('Photo uploaded!')
      } catch (err) {
        console.error('Photo upload failed:', err)
        toast.error('Failed to upload photo')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Print
  async function handlePrint() {
    if (!employee) return

    try {
      const account = getActiveAccount()
      const printedBy = account?.username || 'unknown'
      const empName = employee.fullName || `${employee.firstName} ${employee.lastName}`

      await addPrintRecord(employee.employeeId, empName, printedBy)

      // Update print count on employee record
      if (employee.id) {
        await updateEmployee(employee.id, {
          PrintCount: (employee.printCount || 0) + 1,
          LastPrinted: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Failed to record print:', err)
    }

    setShowPrintModal(false)
    toast.success('Printing badge...')

    // Small delay to let the modal close
    setTimeout(() => {
      printBadge()
    }, 300)
  }

  return (
    <div className="print-page">
      {/* Employee selector */}
      {showSearch && (
        <motion.div
          className="employee-selector"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="selector-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search employee by name, ID, or department..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          {searchResults.length > 0 && (
            <div className="selector-results">
              {searchResults.map((emp) => (
                <button
                  key={emp.employeeId}
                  className="selector-item"
                  onClick={() => selectEmployee(emp)}
                >
                  <User size={16} />
                  <div className="selector-info">
                    <span className="selector-name">{emp.fullName || `${emp.firstName} ${emp.lastName}`}</span>
                    <span className="selector-meta">{emp.department} - {emp.jobTitle}</span>
                  </div>
                  <span className="selector-id">{emp.employeeId}</span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {!showSearch && !employee && (
        <div className="select-prompt">
          <User size={48} strokeWidth={1} />
          <h3>Select an employee</h3>
          <p>Search for an employee to create their badge</p>
          <button className="btn btn-primary" onClick={() => setShowSearch(true)}>
            <Search size={16} /> Search Employees
          </button>
        </div>
      )}

      {employee && (
        <div className="print-layout">
          {/* Left: Photo Section */}
          <div className="photo-section">
            <div className="section-header">
              <h3>Employee Photo</h3>
              {!showSearch && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowSearch(true); setEmployee(null); setPhotoDataUrl(null) }}>
                  Change Employee
                </button>
              )}
            </div>

            <div className="photo-area">
              {showWebcam ? (
                <div className="webcam-container">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.92}
                    videoConstraints={{
                      width: 480,
                      height: 640,
                      facingMode: 'user',
                    }}
                    onUserMedia={() => setWebcamReady(true)}
                    onUserMediaError={() => {
                      toast.error('Could not access webcam.')
                      setShowWebcam(false)
                    }}
                    className="webcam-feed"
                  />
                  <div className="webcam-guide">
                    <div className="guide-frame" />
                  </div>
                  <div className="webcam-controls">
                    <button
                      className="btn btn-primary btn-lg capture-btn"
                      onClick={capturePhoto}
                      disabled={!webcamReady}
                    >
                      <Camera size={20} />
                      Capture Photo
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setShowWebcam(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : photoDataUrl ? (
                <div className="photo-preview">
                  <img src={photoDataUrl} alt="Employee" className="photo-image" />
                  <div className="photo-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowWebcam(true)}>
                      <RotateCcw size={14} /> Retake
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={14} /> Upload New
                    </button>
                  </div>
                </div>
              ) : (
                <div className="photo-placeholder">
                  <div className="placeholder-icon">
                    <Camera size={32} strokeWidth={1} />
                  </div>
                  <p>No photo yet</p>
                  <div className="photo-buttons">
                    <button className="btn btn-primary" onClick={() => setShowWebcam(true)}>
                      <Camera size={16} /> Take Photo
                    </button>
                    <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={16} /> Upload
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {/* Employee Info Summary */}
            <div className="employee-info-card">
              <div className="info-row">
                <span className="info-label">Name</span>
                <span className="info-value">{employee.fullName || `${employee.firstName} ${employee.lastName}`}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Employee ID</span>
                <span className="info-value mono">{employee.badgeNumber || employee.employeeId}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Staff Type</span>
                <span className="info-value">{employee.department || 'MAGMA Staff'}</span>
              </div>
            </div>
          </div>

          {/* Right: Card Preview */}
          <div className="preview-section">
            <div className="section-header">
              <h3>Badge Preview</h3>
            </div>

            {/* Template Switcher */}
            <div className="template-switcher">
              <button
                className={`template-btn ${template === 'premium' ? 'active' : ''}`}
                onClick={() => setTemplate('premium')}
              >
                Premium
              </button>
              <button
                className={`template-btn ${template === 'branded' ? 'active' : ''}`}
                onClick={() => setTemplate('branded')}
              >
                Branded
              </button>
              <button
                className={`template-btn ${template === 'clean' ? 'active' : ''}`}
                onClick={() => setTemplate('clean')}
              >
                Clean White
              </button>
              <button
                className={`template-btn ${template === 'marketing' ? 'active' : ''}`}
                onClick={() => setTemplate('marketing')}
              >
                Marketing
              </button>
            </div>

            <div className="card-preview-wrapper">
              <BadgeCard
                template={template}
                employee={employee}
                photoDataUrl={photoDataUrl}
              />
            </div>

            <button
              className="print-btn"
              onClick={() => setShowPrintModal(true)}
            >
              <Printer size={20} />
              Print Badge
            </button>
          </div>
        </div>
      )}

      {/* Hidden print area */}
      <div id="print-area" className="print-only">
        {employee && (
          <div className="badge-card-print">
            <BadgeCard
              template={template}
              employee={employee}
              photoDataUrl={photoDataUrl}
            />
          </div>
        )}
      </div>

      {/* Print Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPrintModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Print Badge</h3>
                <button className="modal-close" onClick={() => setShowPrintModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="print-instructions">
                  <h4>Step 1: Open the system print dialog</h4>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                    When the print dialog opens, click <strong>"Print using system dialog"</strong> at the bottom left, or press <strong>Ctrl+Shift+P</strong>
                  </p>
                  <h4>Step 2: Set these options:</h4>
                  <ul>
                    <li><Check size={14} /> Printer: <strong>Evolis Primacy 2</strong></li>
                    <li><Check size={14} /> Paper size: <strong>CR80</strong></li>
                    <li><Check size={14} /> Scale: <strong>150%</strong></li>
                    <li><Check size={14} /> Margins: <strong>None</strong></li>
                    <li><Check size={14} /> Check <strong>"Background graphics"</strong> ✅</li>
                    <li><Check size={14} /> Pages per sheet: <strong>1</strong></li>
                  </ul>
                </div>
                {!photoDataUrl && (
                  <div className="print-warning">
                    <AlertCircle size={16} />
                    <span>No photo has been added. The badge will print without a photo.</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowPrintModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-lg" onClick={handlePrint}>
                  <Printer size={18} />
                  Print Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BadgeCard({ template, employee, photoDataUrl }) {
  const logoSrc = import.meta.env.BASE_URL + 'magma-logo.png'
  const logoWhiteSrc = import.meta.env.BASE_URL + 'magma-logo-white.jpg'
  const buildingSrc = import.meta.env.BASE_URL + 'magma-building.jpg'
  const staffType = employee.department || 'MAGMA Staff'
  const employeeId = employee.badgeNumber || employee.employeeId
  const fullName = `${employee.lastName} ${employee.firstName}`.trim()

  const photoEl = (
    <div className="badge-photo">
      {photoDataUrl ? (
        <img src={photoDataUrl} alt="" />
      ) : (
        <div className="badge-photo-placeholder">
          <User size={28} strokeWidth={1} />
        </div>
      )}
    </div>
  )

  const fieldsEl = (
    <div className="badge-fields">
      {template !== 'branded' && (
        <img src={logoSrc} alt="MAGMA" className="badge-fields-logo" />
      )}
      <div className="badge-field">
        <span className="badge-field-label">Name:</span>
        <span className="badge-field-value">{fullName}</span>
      </div>
      <div className="badge-field staff-type">
        <span className="badge-field-label">Staff Type:</span>
        <span className="badge-field-value">{staffType}</span>
      </div>
      <div className="badge-field">
        <span className="badge-field-label">Employee ID:</span>
        <span className="badge-field-value">{employeeId}</span>
      </div>
    </div>
  )

  // Branded: [NAVY HEADER with logo] [photo left | title+fields right] [COLORFUL FOOTER]
  if (template === 'branded') {
    return (
      <div className="badge-card template-branded">
        <div className="branded-header">
          <img src={logoSrc} alt="MAGMA" className="branded-header-logo" />
        </div>
        <div className="branded-body">
          {photoEl}
          <div className="branded-info">
            <div className="branded-title">Staff ID Card</div>
            {fieldsEl}
          </div>
        </div>
        <div className="branded-footer">
          <div className="stripe-segment stripe-cyan" />
          <div className="stripe-segment stripe-pink" />
          <div className="stripe-segment stripe-green" />
          <div className="stripe-segment stripe-yellow" />
          <div className="stripe-segment stripe-blue" />
        </div>
      </div>
    )
  }

  // Marketing: vertical portrait with building bg, circular photo, purple footer
  if (template === 'marketing') {
    return (
      <div className="badge-card template-marketing">
        <div className="marketing-bg">
          <img src={buildingSrc} alt="" />
        </div>
        <div className="marketing-content">
          <img src={logoSrc} alt="MAGMA" className="marketing-logo" />
          <div className="marketing-photo">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="" />
            ) : (
              <div className="marketing-photo-placeholder">
                <User size={28} strokeWidth={1} />
              </div>
            )}
          </div>
          <div className="marketing-name">{fullName}</div>
          <div className="marketing-role">{staffType}</div>
        </div>
        <div className="marketing-footer">
          <span className="marketing-footer-text">{employeeId}</span>
        </div>
      </div>
    )
  }

  // Premium & Clean: [photo] [fields with logo] (+ building bg for premium)
  return (
    <div className={`badge-card template-${template}`}>
      {template === 'premium' && (
        <div className="badge-bg-image">
          <img src={buildingSrc} alt="" />
        </div>
      )}
      <div className="badge-body-area">
        <div className="badge-content">
          {photoEl}
          {fieldsEl}
        </div>
      </div>
    </div>
  )
}
