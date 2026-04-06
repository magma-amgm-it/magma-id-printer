import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, RotateCcw, Printer, Search, Check,
  AlertCircle, X, User
} from 'lucide-react'
import Webcam from 'react-webcam'
import toast from 'react-hot-toast'
import {
  getClient, getAllClients, uploadPhoto, downloadPhoto,
  addPrintRecord
} from '../services/graphApi'
import { getActiveAccount } from '../services/auth'
import { printBadge } from '../services/printService'
import './PrintBadge.css'

export default function PrintClient() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const webcamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [client, setClient] = useState(null)
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamReady, setWebcamReady] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(!clientId)

  const [showPrintModal, setShowPrintModal] = useState(false)

  useEffect(() => {
    if (clientId) loadClient(clientId)
  }, [clientId])

  async function loadClient(id) {
    try {
      const c = await getClient(id)
      if (c) {
        setClient(c)
        setShowSearch(false)
        const url = await downloadPhoto(id, 'Client Photos')
        setPhotoDataUrl(url)
      }
    } catch (err) {
      console.error('Failed to load client:', err)
      toast.error('Failed to load client data')
    }
  }

  async function handleSearch(query) {
    setSearchQuery(query)
    if (query.trim().length >= 1) {
      try {
        const allClients = await getAllClients()
        const terms = query.toLowerCase().split(/\s+/)
        const results = allClients.filter((c) =>
          terms.every((term) => c.searchText?.includes(term))
        )
        setSearchResults(results.slice(0, 10))
      } catch (err) {
        console.error('Search failed:', err)
      }
    } else {
      setSearchResults([])
    }
  }

  function selectClient(c) {
    navigate(`/print-client/${c.clientId}`, { replace: true })
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  const capturePhoto = useCallback(async () => {
    if (!webcamRef.current) return
    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) return

    const res = await fetch(imageSrc)
    const blob = await res.blob()

    try {
      await uploadPhoto(client.clientId, blob, 'Client Photos')
      setPhotoDataUrl(imageSrc)
      setShowWebcam(false)
      toast.success('Photo captured and uploaded!')
    } catch (err) {
      console.error('Photo upload failed:', err)
      toast.error('Failed to upload photo')
    }
  }, [client])

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
      const res = await fetch(dataUrl)
      const blob = await res.blob()

      try {
        await uploadPhoto(client.clientId, blob, 'Client Photos')
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

  async function handlePrint() {
    if (!client) return

    try {
      const account = getActiveAccount()
      const printedBy = account?.username || 'unknown'
      const name = client.fullName || `${client.firstName} ${client.lastName}`
      await addPrintRecord(client.clientId, name, printedBy)
    } catch (err) {
      console.error('Failed to record print:', err)
    }

    setShowPrintModal(false)
    toast.success('Printing ID card...')

    setTimeout(() => {
      printBadge()
    }, 300)
  }

  return (
    <div className="print-page">
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
              placeholder="Search client by name, program, or ID..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          {searchResults.length > 0 && (
            <div className="selector-results">
              {searchResults.map((c) => (
                <button
                  key={c.clientId}
                  className="selector-item"
                  onClick={() => selectClient(c)}
                >
                  <User size={16} />
                  <div className="selector-info">
                    <span className="selector-name">{c.fullName}</span>
                    <span className="selector-meta">{c.program}</span>
                  </div>
                  <span className="selector-id">{c.clientId}</span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {!showSearch && !client && (
        <div className="select-prompt">
          <User size={48} strokeWidth={1} />
          <h3>Select a client</h3>
          <p>Search for a client to create their ID card</p>
          <button className="btn btn-primary" onClick={() => setShowSearch(true)}>
            <Search size={16} /> Search Clients
          </button>
        </div>
      )}

      {client && (
        <div className="print-layout">
          {/* Left: Photo Section */}
          <div className="photo-section">
            <div className="section-header">
              <h3>Client Photo</h3>
              {!showSearch && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowSearch(true); setClient(null); setPhotoDataUrl(null) }}>
                  Change Client
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
                    <button className="btn btn-ghost" onClick={() => setShowWebcam(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : photoDataUrl ? (
                <div className="photo-preview">
                  <img src={photoDataUrl} alt="Client" className="photo-image" />
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

            <div className="employee-info-card">
              <div className="info-row">
                <span className="info-label">Name</span>
                <span className="info-value">{client.fullName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">ID</span>
                <span className="info-value mono">{client.clientId}</span>
              </div>
              {client.program && (
                <div className="info-row">
                  <span className="info-label">Program</span>
                  <span className="info-value">{client.program}</span>
                </div>
              )}
              {client.email && (
                <div className="info-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{client.email}</span>
                </div>
              )}
              {client.startDate && (
                <div className="info-row">
                  <span className="info-label">Start Date</span>
                  <span className="info-value">{new Date(client.startDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Card Preview */}
          <div className="preview-section">
            <div className="section-header">
              <h3>ID Card Preview</h3>
            </div>

            <div className="card-preview-wrapper">
              <div className="badge-card">
                <div className="badge-header">
                  <img src={import.meta.env.BASE_URL + 'logo.jpg'} alt="Company" className="badge-logo" />
                </div>
                <div className="badge-body">
                  <div className="badge-photo">
                    {photoDataUrl ? (
                      <img src={photoDataUrl} alt="" />
                    ) : (
                      <div className="badge-photo-placeholder">
                        <User size={32} strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  <div className="badge-info">
                    <div className="badge-name">
                      {client.firstName} {client.lastName}
                    </div>
                    {client.program && (
                      <div className="badge-title">{client.program}</div>
                    )}
                    <div className="badge-dept">Language School</div>
                  </div>
                </div>
                <div className="badge-footer">
                  <span className="badge-number">{client.clientId}</span>
                  {client.startDate && (
                    <span className="badge-id">{new Date(client.startDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              className="print-btn"
              onClick={() => setShowPrintModal(true)}
            >
              <Printer size={20} />
              Print ID Card
            </button>
          </div>
        </div>
      )}

      {/* Hidden print area */}
      <div id="print-area" className="print-only">
        {client && (
          <div className="badge-card badge-card-print">
            <div className="badge-header">
              <img src={import.meta.env.BASE_URL + 'logo.jpg'} alt="Company" className="badge-logo" />
            </div>
            <div className="badge-body">
              <div className="badge-photo">
                {photoDataUrl ? (
                  <img src={photoDataUrl} alt="" />
                ) : (
                  <div className="badge-photo-placeholder">
                    <User size={32} strokeWidth={1} />
                  </div>
                )}
              </div>
              <div className="badge-info">
                <div className="badge-name">
                  {client.firstName} {client.lastName}
                </div>
                {client.program && (
                  <div className="badge-title">{client.program}</div>
                )}
                <div className="badge-dept">Language School</div>
              </div>
            </div>
            <div className="badge-footer">
              <span className="badge-number">{client.clientId}</span>
              {client.startDate && (
                <span className="badge-id">{new Date(client.startDate).toLocaleDateString()}</span>
              )}
            </div>
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
                <h3>Print ID Card</h3>
                <button className="modal-close" onClick={() => setShowPrintModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="print-instructions">
                  <h4>Before printing, make sure:</h4>
                  <ul>
                    <li><Check size={14} /> Select <strong>Evolis Primacy 2</strong> as the printer</li>
                    <li><Check size={14} /> Set margins to <strong>None</strong></li>
                    <li><Check size={14} /> Scale should be <strong>100%</strong> (not "Fit to page")</li>
                    <li><Check size={14} /> Turn off headers and footers</li>
                  </ul>
                </div>
                {!photoDataUrl && (
                  <div className="print-warning">
                    <AlertCircle size={16} />
                    <span>No photo has been added. The card will print without a photo.</span>
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
