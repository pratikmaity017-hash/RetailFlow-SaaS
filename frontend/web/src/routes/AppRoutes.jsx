import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";

import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import VerifyEmailPage from "../features/auth/pages/VerifyEmailPage";

import DashboardPage from "../features/dashboard/pages/DashboardPage";

import ProductListPage from "../features/products/pages/ProductListPage";
import CreateProductPage from "../features/products/pages/CreateProductPage";
import EditProductPage from "../features/products/pages/EditProductPage";
import ProductVariantsPage from "../features/products/pages/ProductVariantsPage";

import AppLayout from "../layouts/AppLayout";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="route-loading">Loading RetailFlow...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="route-loading">Loading RetailFlow...</div>;
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />

      <Route
        path="/register"
        element={
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        }
      />

      <Route path="/verify-email" element={<VerifyEmailPage />} />
      {/* Protected Routes with Shared Sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/products" element={<ProductListPage />} />

        <Route path="/products/new" element={<CreateProductPage />} />

        <Route path="/products/:productId/edit" element={<EditProductPage />} />

        <Route
          path="/products/:productId/variants"
          element={<ProductVariantsPage />}
        />
      </Route>

      {/* Default Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoutes;
