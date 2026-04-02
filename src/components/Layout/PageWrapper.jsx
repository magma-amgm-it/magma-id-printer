import { motion } from 'framer-motion'
import './PageWrapper.css'

export default function PageWrapper({ title, children }) {
  return (
    <div className="page-wrapper">
      <header className="page-topbar">
        <h2 className="page-title">{title}</h2>
      </header>
      <motion.div
        className="page-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  )
}
