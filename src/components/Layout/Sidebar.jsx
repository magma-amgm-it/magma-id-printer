import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Upload, Users, Printer, CreditCard, LogOut } from 'lucide-react'
import './Sidebar.css'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/import', icon: Upload, label: 'Import Data' },
  { path: '/employees', icon: Users, label: 'Employees' },
  { path: '/print', icon: Printer, label: 'Print Badge' },
]

export default function Sidebar({ user, onLogout }) {
  const location = useLocation()

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

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

      {user && (
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-email">{user.email}</span>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={onLogout}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-version">
          <span>v2.0.0</span>
          <span className="separator">|</span>
          <span>Evolis Primacy 2</span>
        </div>
      </div>
    </aside>
  )
}
