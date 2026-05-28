import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import Cropper from 'react-easy-crop'

/**
 * Crop modal. Lets the user drag a crop rectangle over the photo and
 * outputs the cropped result as a data URL.
 *
 * Props:
 *  - photoUrl: string         original photo data url
 *  - aspect: number           crop aspect ratio (default 3/4 portrait)
 *  - onChange(dataUrl)        called with the cropped result on Save
 *  - onClose()                called on Cancel / overlay click
 */
export default function CropModal({ photoUrl, aspect = 3 / 4, onChange, onClose }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleSave() {
    if (!croppedAreaPixels) return
    setBusy(true)
    try {
      const result = await getCroppedImg(photoUrl, croppedAreaPixels)
      onChange(result)
    } catch (err) {
      console.error('Crop failed:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
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
        style={{ maxWidth: 560 }}
      >
        <div className="modal-header">
          <h3>Crop photo</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="crop-stage">
            <Cropper
              image={photoUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          </div>
          <div className="crop-controls">
            <label className="crop-label">Zoom</label>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="crop-slider"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={busy || !croppedAreaPixels}
          >
            {busy ? 'Cropping…' : (<><Check size={16} /> Save crop</>)}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* Render the cropped region into a canvas and return a data URL. */
async function getCroppedImg(srcUrl, area) {
  const img = await loadImage(srcUrl)
  const canvas = document.createElement('canvas')
  canvas.width = area.width
  canvas.height = area.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  )
  return canvas.toDataURL('image/jpeg', 0.92)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
