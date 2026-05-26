import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

/**
 * Click-anywhere-on-the-photo focal point picker.
 * `value` is { x, y } as percentages (0-100). Defaults to 50/30 (face).
 * `onChange(focus)` fires on Save; `onClose()` fires on Cancel / overlay click.
 */
export default function FocalPointPicker({ photoUrl, value, onChange, onClose }) {
  const [focus, setFocus] = useState(value || { x: 50, y: 30 })
  const containerRef = useRef(null)

  function pickAt(e) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setFocus({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    })
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
        style={{ maxWidth: 520 }}
      >
        <div className="modal-header">
          <h3>Adjust photo position</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p className="focal-hint">
            Click anywhere on the photo to set the focal point. Whatever you
            click on will stay visible on every card template, even when the
            photo gets cropped to fit.
          </p>
          <div
            ref={containerRef}
            className="focal-photo-wrap"
            onClick={pickAt}
          >
            <img src={photoUrl} alt="" className="focal-photo" />
            <div
              className="focal-dot"
              style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onChange(focus)}>
            <Check size={16} /> Save position
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
