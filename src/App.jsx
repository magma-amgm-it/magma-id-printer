import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar'
import PageWrapper from './components/Layout/PageWrapper'
import Dashboard from './pages/Dashboard'
import ImportData from './pages/ImportData'
import EmployeeList from './pages/EmployeeList'
import PrintBadge from './pages/PrintBadge'
import './App.css'

function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PageWrapper title="Dashboard"><Dashboard /></PageWrapper>} />
          <Route path="/import" element={<PageWrapper title="Import Data"><ImportData /></PageWrapper>} />
          <Route path="/employees" element={<PageWrapper title="Employees"><EmployeeList /></PageWrapper>} />
          <Route path="/print/:employeeId?" element={<PageWrapper title="Print Badge"><PrintBadge /></PageWrapper>} />
        </Routes>
      </main>
    </div>
  )
}

export default App
