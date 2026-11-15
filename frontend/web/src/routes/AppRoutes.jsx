import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";

import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import VerifyEmailPage from "../features/auth/pages/VerifyEmailPage";

import DashboardPage from "../features/dashboard/pages/DashboardPage";
import CreateOrganizationPage from "../features/organization/pages/CreateOrganizationPage";

import ProductListPage from "../features/products/pages/ProductListPage";
import CreateProductPage from "../features/products/pages/CreateProductPage";
import EditProductPage from "../features/products/pages/EditProductPage";
import ProductVariantsPage from "../features/products/pages/ProductVariantsPage";

import InventoryOverviewPage from "../features/inventory/pages/InventoryOverviewPage";
import StockAdjustmentPage from "../features/inventory/pages/StockAdjustmentPage";

import AppLayout from "../layouts/AppLayout";
import AppLoader from "../shared/components/AppLoader";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader />;
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

      {/* Protected Organization Onboarding Route */}
      <Route
        path="/organizations/new"
        element={
          <ProtectedRoute>
            <CreateOrganizationPage />
          </ProtectedRoute>
        }
      />

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

        <Route path="/inventory" element={<InventoryOverviewPage />} />
        <Route
          path="/inventory/adjustments"
          element={<StockAdjustmentPage />}
        />
      </Route>

      {/* Default Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoutes;
