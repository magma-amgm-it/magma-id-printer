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
  // 'premium' | 'branded' | 'clean' | 'marketing' | 'spotlight' | 'mirror' | 'portrait'
  const [template, setTemplate] = useState('premium')

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
                <span className="info-value">{employee.department || 'MAGMA'}</span>
              </div>
            </div>
          </div>

          {/* Right: Card Preview */}
          <div className="preview-section">
            <div className="section-header">
              <h3>Badge Preview</h3>
            </div>

            {/* Template Selector */}
            <div className="template-select-wrap">
              <select
                className="template-select"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                aria-label="Card design"
              >
                <option value="premium">Premium</option>
                <option value="branded">Branded</option>
                <option value="clean">Clean White</option>
                <option value="marketing">Marketing</option>
                <option value="spotlight">Spotlight</option>
                <option value="mirror">Mirror</option>
                <option value="portrait">Portrait</option>
              </select>
              <ChevronDown size={16} className="template-select-icon" />
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
                  <h4>Print settings:</h4>
                  <ul>
                    <li><Check size={14} /> Printer: <strong>Evolis Primacy 2</strong></li>
                    <li><Check size={14} /> Click <strong>"More settings"</strong> to expand options</li>
                    <li><Check size={14} /> Paper size: <strong>CR80</strong></li>
                    <li><Check size={14} /> Scale: <strong>150%</strong></li>
                    <li><Check size={14} /> Margins: <strong>None</strong></li>
                    <li><Check size={14} /> Check <strong>"Background graphics"</strong></li>
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
  const logoWhiteSrc = import.meta.env.BASE_URL + 'magma-logo-white.png'
  const buildingSrc = import.meta.env.BASE_URL + 'magma-building.jpg'
  const staffType = employee.department || 'MAGMA'
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
          <img src={logoWhiteSrc} alt="MAGMA" className="branded-header-logo" />
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
      <div className="badge-card template-marketing marketing-employee">
        <div className="marketing-bg">
          <img src={buildingSrc} alt="" />
        </div>
        <div className="marketing-content">
          <img
            src={import.meta.env.BASE_URL + 'magma-logo-white-tight.png'}
            alt="MAGMA AMGM"
            className="marketing-logo"
          />
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
        </div>
        <div className="marketing-footer">
          <span className="marketing-footer-text">{employeeId}</span>
        </div>
      </div>
    )
  }

  // Spotlight: navy card, large serif name, curved photo on right,
  // footer band with Department + Employee ID (+ optional QR)
  if (template === 'spotlight') {
    const spotFirst = employee.firstName || fullName.split(' ')[0] || ''
    const spotLast =
      employee.lastName || fullName.split(' ').slice(1).join(' ') || ''
    const qrSrc = employee.qrCodeUrl || employee.qrCode || null

    // Auto-size the name by longest word so long names never overflow
    const longestName = Math.max(spotFirst.length, spotLast.length, 1)
    const nameSize =
      longestName <= 9 ? 6.4
      : longestName <= 11 ? 5.6
      : longestName <= 14 ? 4.7
      : 4.0

    return (
      <div className="badge-card template-spotlight">
        {/* Photo — curved left edge, anchored to the right */}
        <div className="spotlight-photo">
          {photoDataUrl ? (
            <img src={photoDataUrl} alt="" />
          ) : (
            <div className="spotlight-photo-placeholder">
              <User size={28} strokeWidth={1} />
            </div>
          )}
        </div>

        {/* Text column */}
        <div className="spotlight-content">
          <img
            src={import.meta.env.BASE_URL + 'magma-logo-white-tight.png'}
            alt="MAGMA AMGM"
            className="spotlight-logo"
          />

          <div
            className="spotlight-name"
            style={{ fontSize: `${nameSize}mm` }}
          >
            <span className="spotlight-name-line">{spotFirst}</span>
            {spotLast && (
              <span className="spotlight-name-line">{spotLast}</span>
            )}
          </div>

          <div className="spotlight-accent" />

          <div className={`spotlight-footer${qrSrc ? ' has-qr' : ''}`}>
            <div className="spotlight-meta">
              <span className="spotlight-meta-label">Staff Type</span>
              <span className="spotlight-meta-value">{staffType}</span>
            </div>
            <div className="spotlight-meta">
              <span className="spotlight-meta-label">Employee ID</span>
              <span className="spotlight-meta-value">{employeeId}</span>
            </div>
            {qrSrc && (
              <div className="spotlight-qr">
                <img src={qrSrc} alt="QR code" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Mirror: photo on the left, curved purple panel on the right.
  // Fields: name, staff type, employee ID (no job title).
  if (template === 'mirror') {
    const mFirst = employee.firstName || fullName.split(' ')[0] || ''
    const mLast =
      employee.lastName || fullName.split(' ').slice(1).join(' ') || ''
    const longest = Math.max(mFirst.length, mLast.length, 1)
    const nameSize =
      longest <= 9 ? 6.2 : longest <= 11 ? 5.4 : longest <= 14 ? 4.6 : 3.9
    const logoTight = import.meta.env.BASE_URL + 'magma-logo-white-tight.png'

    return (
      <div className="badge-card template-mirror">
        <div className="mirror-photo">
          {photoDataUrl ? (
            <img src={photoDataUrl} alt="" />
          ) : (
            <div className="mirror-photo-placeholder">
              <User size={28} strokeWidth={1} />
            </div>
          )}
        </div>
        <div className="mirror-panel">
          <img src={logoTight} alt="MAGMA AMGM" className="mirror-logo" />
          <div className="mirror-name" style={{ fontSize: `${nameSize}mm` }}>
            <span className="mirror-name-line">{mFirst}</span>
            {mLast && <span className="mirror-name-line">{mLast}</span>}
          </div>
          <div className="mirror-accent" />
          <div className="mirror-footer">
            <div className="mirror-meta">
              <span className="mirror-meta-label">Staff Type</span>
              <span className="mirror-meta-value">{staffType}</span>
            </div>
            <div className="mirror-meta">
              <span className="mirror-meta-label">Employee ID</span>
              <span className="mirror-meta-value">{employeeId}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Portrait: vertical card, photo on top, curved purple panel below.
  // Fields: name (single line, centered) + employee ID (centered).
  if (template === 'portrait') {
    const nameLen = fullName.length || 1
    const nameSize =
      nameLen <= 14 ? 5.2 : nameLen <= 18 ? 4.4 : nameLen <= 22 ? 3.7 : 3.2
    const logoTight = import.meta.env.BASE_URL + 'magma-logo-white-tight.png'

    return (
      <div className="badge-card template-portrait">
        <div className="portrait-photo">
          {photoDataUrl ? (
            <img src={photoDataUrl} alt="" />
          ) : (
            <div className="portrait-photo-placeholder">
              <User size={32} strokeWidth={1} />
            </div>
          )}
        </div>
        <img src={logoTight} alt="MAGMA AMGM" className="portrait-logo" />
        <div className="portrait-panel">
          <div className="portrait-name" style={{ fontSize: `${nameSize}mm` }}>
            <span className="portrait-name-line">{fullName}</span>
          </div>
          <div className="portrait-accent" />
          <div className="portrait-footer">
            <div className="portrait-meta">
              <span className="portrait-meta-value">{employeeId}</span>
            </div>
          </div>
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
