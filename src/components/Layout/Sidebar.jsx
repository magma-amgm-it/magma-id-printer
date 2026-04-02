import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Upload, Users, Printer, CreditCard } from 'lucide-react'
import './Sidebar.css'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/import', icon: Upload, label: 'Import Data' },
  { path: '/employees', icon: Users, label: 'Employees' },
  { path: '/print', icon: Printer, label: 'Print Badge' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <CreditCard size={28} strokeWidth={1.5} />
        </div>
        <div className="sidebar-brand">
          <h1>MAGMA</h1>
          <span>ID Printer</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `sidebar-link ${isActive || (path === '/print' && location.pathname.startsWith('/print')) ? 'active' : ''}`
            }
          >
            <Icon size={20} strokeWidth={1.5} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">
          <span>v1.0.0</span>
          <span className="separator">|</span>
          <span>Evolis Primacy 2</span>
        </div>
      </div>
    </aside>
  )
}
