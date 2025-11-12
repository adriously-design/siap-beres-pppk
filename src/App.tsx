import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPPPK from "./pages/AuthPPPK";
import AuthAdmin from "./pages/AuthAdmin";
import ResetPasswordPPPK from "./pages/ResetPasswordPPPK";
import DashboardPPPK from "./pages/DashboardPPPK";
import DashboardAdmin from "./pages/DashboardAdmin";
import ManajemenPengguna from "./pages/ManajemenPengguna";
import ManajemenAdmin from "./pages/ManajemenAdmin";
import UploadDokumen from "./pages/UploadDokumen";
import EBimtek from "./pages/EBimtek";
import KelolaEBimtek from "./pages/KelolaEBimtek";
import ReviewDokumen from "./pages/ReviewDokumen";
import ReviewDokumenDetail from "./pages/ReviewDokumenDetail";
import RiwayatAktivitas from "./pages/RiwayatAktivitas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth-pppk" element={<AuthPPPK />} />
            <Route path="/reset-password-pppk" element={<ResetPasswordPPPK />} />
            <Route path="/auth-admin" element={<AuthAdmin />} />
            <Route 
              path="/dashboard-pppk" 
              element={
                <ProtectedRoute allowedRoles={['calon_pppk']}>
                  <DashboardPPPK />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard-admin" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <DashboardAdmin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manajemen-pengguna" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <ManajemenPengguna />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manajemen-admin" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <ManajemenAdmin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/upload-dokumen" 
              element={
                <ProtectedRoute allowedRoles={['calon_pppk']}>
                  <UploadDokumen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/e-bimtek" 
              element={
                <ProtectedRoute allowedRoles={['calon_pppk']}>
                  <EBimtek />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kelola-e-bimtek" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <KelolaEBimtek />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/review-dokumen" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <ReviewDokumen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/review-dokumen/:userId" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <ReviewDokumenDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/riwayat-aktivitas" 
              element={
                <ProtectedRoute allowedRoles={['admin_bkd']}>
                  <RiwayatAktivitas />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
