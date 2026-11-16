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
import CustomerListPage from "../features/customers/pages/CustomerListPage";
import CreateCustomerPage from "../features/customers/pages/CreateCustomerPage";
import EditCustomerPage from "../features/customers/pages/EditCustomerPage";
import CustomerDetailsPage from "../features/customers/pages/CustomerDetailsPage";
import SupplierListPage from "../features/suppliers/pages/SupplierListPage";
import SupplierCreatePage from "../features/suppliers/pages/SupplierCreatePage";
import SupplierDetailsPage from "../features/suppliers/pages/SupplierDetailsPage";

import AppLayout from "../layouts/AppLayout";
import AppLoader from "../shared/components/AppLoader";
import PageNotFound from "../shared/pages/PageNotFound";
import "./auth-server-error.css";

function ProtectedRoute({ children }) {
  const {
    isAuthenticated,
    isLoading,
    authError,
    retrySessionRestore,
    isRetrying,
  } = useAuth();

  if (isLoading) {
    return <AppLoader />;
  }

  if (authError) {
    return (
      <div className="auth-server-error">
        <div className="auth-server-error-card">
          <div className="auth-error-icon-wrapper">
            <div className="auth-error-icon">☁</div>
            <span className="auth-error-icon-alert">!</span>
          </div>

          <span className="auth-error-eyebrow">CONNECTION INTERRUPTED</span>

          <h2>Oops! Server Unavailable</h2>

          <p>
            We’re having trouble connecting to RetailFlow. Your session is safe.
            Please check your connection and try again.
          </p>

          <button
            type="button"
            onClick={retrySessionRestore}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <span className="auth-retry-spinner"></span>
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <span>Retry Connection</span>
                <span className="auth-retry-arrow">→</span>
              </>
            )}
          </button>

          <div className="auth-connection-status">
            <span className="auth-status-dot"></span>
            Waiting for server connection
          </div>
        </div>

        <div className="auth-error-footer">
          <span>RetailFlow SaaS</span>
          <span>Reliable retail management</span>
        </div>
      </div>
    );
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
        <Route path="/customers" element={<CustomerListPage />} />
        <Route path="/customers/new" element={<CreateCustomerPage />} />
        <Route
          path="/customers/:customerId/edit"
          element={<EditCustomerPage />}
        />
        <Route
          path="/customers/:customerId"
          element={<CustomerDetailsPage />}
        />

        <Route path="/suppliers" element={<SupplierListPage />} />
        <Route path="/suppliers/new" element={<SupplierCreatePage />} />
        <Route
          path="/suppliers/:supplierId"
          element={<SupplierDetailsPage />}
        />
      </Route>

      {/* Default Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default AppRoutes;
