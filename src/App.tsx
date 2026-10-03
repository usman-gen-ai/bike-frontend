import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { BikesPage } from './pages/BikesPage'
import { LoginPage } from './pages/LoginPage'
import { RequireAuth } from './components/RequireAuth'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><BikesPage /></RequireAuth>} />
        <Route path="/legacy" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
