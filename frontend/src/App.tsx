import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/lib/auth-context"
import { AdminRoute, ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AppLayout } from "@/components/layout/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { LeadsListPage } from "@/pages/LeadsListPage"
import { LeadDetailPage } from "@/pages/LeadDetailPage"
import { AddLeadPage } from "@/pages/AddLeadPage"
import { UsersAdminPage } from "@/pages/UsersAdminPage"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/leads" replace />} />
              <Route path="/leads" element={<LeadsListPage />} />
              <Route path="/leads/new" element={<AddLeadPage />} />
              <Route path="/leads/:id" element={<LeadDetailPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/users" element={<UsersAdminPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
