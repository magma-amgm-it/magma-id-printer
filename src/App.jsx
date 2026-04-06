import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, LogIn, Shield, Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/Layout/Sidebar'
import PageWrapper from './components/Layout/PageWrapper'
import Dashboard from './pages/Dashboard'
import ImportData from './pages/ImportData'
import EmployeeList from './pages/EmployeeList'
import PrintBadge from './pages/PrintBadge'
import ClientList from './pages/ClientList'
import PrintClient from './pages/PrintClient'
import './App.css'

function LoginScreen({ onLogin, loading, error }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      flexDirection: 'column',
      gap: 32,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          padding: 48,
          borderRadius: 24,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: 420,
          width: '90%',
        }}
      >
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(99,102,241,0.1))',
          border: '1px solid rgba(37,99,235,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CreditCard size={36} color="var(--accent-primary)" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            MAGMA
          </h1>
          <p style={{
            color: 'var(--accent-primary)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            ID Printer
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 8,
          background: 'rgba(37,99,235,0.05)',
          border: '1px solid rgba(37,99,235,0.1)',
        }}>
          <Shield size={14} color="var(--accent-primary)" />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Sign in with your MAGMA Microsoft account
          </span>
        </div>

        {error && (
          <div style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: 'rgba(220,38,38,0.05)',
            border: '1px solid rgba(220,38,38,0.15)',
            color: 'var(--accent-danger)',
            fontSize: 13,
            width: '100%',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 12,
            background: loading ? 'rgba(37,99,235,0.3)' : 'var(--accent-primary)',
            border: 'none',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {loading ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Signing in...
            </>
          ) : (
            <>
              <LogIn size={20} />
              Sign in with Microsoft
            </>
          )}
        </motion.button>
      </motion.div>

      <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
        MAGMA Settlement & Community Services
      </p>
    </div>
  );
}

function App() {
  const { isAuthenticated, user, login, logout, loading } = useAuth()

  if (loading && !isAuthenticated) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
      }}>
        <Loader2 size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} loading={loading} />
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={logout} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PageWrapper title="Dashboard"><Dashboard /></PageWrapper>} />
          <Route path="/import" element={<PageWrapper title="Import Data"><ImportData /></PageWrapper>} />
          <Route path="/employees" element={<PageWrapper title="Employees"><EmployeeList /></PageWrapper>} />
          <Route path="/print/:employeeId?" element={<PageWrapper title="Print Badge"><PrintBadge /></PageWrapper>} />
          <Route path="/clients" element={<PageWrapper title="Clients"><ClientList /></PageWrapper>} />
          <Route path="/print-client/:clientId?" element={<PageWrapper title="Print Client ID"><PrintClient /></PageWrapper>} />
        </Routes>
      </main>
    </div>
  )
}

export default App
