import { useEffect, useState } from "react";
import { Link, useLocation   } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import {
  getUserOrganizations,
  getOrganizationContext,
} from "../../organization/organizationService";
import { getProducts } from "../../products/productService";

import "./dashboard.css";

function formatRole(role) {
  if (!role) return "Unknown";

  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const location = useLocation();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [organizationContext, setOrganizationContext] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsOrganizationId, setProductsOrganizationId] = useState("");
  const [productsError, setProductsError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load organizations available to the authenticated user.
  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        setIsLoading(true);
        setError("");

        const response = await getUserOrganizations();
        const availableOrganizations = response?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        if (availableOrganizations.length === 1) {
          setSelectedOrganizationId(availableOrganizations[0].organization.id);
        } else if (availableOrganizations.length === 0) {
          setError("No active organization is available for your account.");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load organizations.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load the selected organization's context.
  useEffect(() => {
    if (!selectedOrganizationId) {
      setOrganizationContext(null);
      return;
    }

    let isMounted = true;

    async function loadOrganizationContext() {
      try {
        setOrganizationContext(null);

        const response = await getOrganizationContext(selectedOrganizationId);

        if (isMounted) {
          setOrganizationContext(response?.data || null);
        }
      } catch (err) {
        if (isMounted) {
          setOrganizationContext(null);
          setError(err.message || "Unable to load organization details.");
        }
      }
    }

    loadOrganizationContext();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  // Load real product data for the selected organization.
  useEffect(() => {
    if (!selectedOrganizationId) {
      setProducts([]);
      setProductsOrganizationId("");
      setProductsError("");
      return;
    }

    let isMounted = true;

    async function loadProducts() {
      try {
        setProductsError("");

        const response = await getProducts(selectedOrganizationId);

        if (isMounted) {
          setProducts(response?.data?.products || []);
          setProductsOrganizationId(selectedOrganizationId);
        }
      } catch (err) {
        if (isMounted) {
          setProducts([]);
          setProductsOrganizationId(selectedOrganizationId);
          setProductsError(err.message || "Unable to load products.");
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const organizationName =
    organizationContext?.organization?.name ||
    selectedOrganization?.organization?.name ||
    "Organization";

  const userRole =
    selectedOrganization?.role || organizationContext?.membership?.role;

  const canCreateProducts = ["owner", "manager"].includes(userRole);

  const productDataReady = productsOrganizationId === selectedOrganizationId;

  const activeProducts = products.filter(
    (product) => product.status === "active",
  ).length;

  const inactiveProducts = products.filter(
    (product) => product.status === "inactive",
  ).length;

  // Backend already returns products sorted by creation date.
  const recentProducts = products.slice(0, 5);

  if (isLoading) {
    return (
      <main className="dashboard-placeholder">
        <p>Loading your RetailFlow dashboard...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">RETAILFLOW SAAS</p>

          <h1 className="dashboard-title">Welcome to RetailFlow</h1>

          <p className="dashboard-subtitle">
            Manage your retail business from one place.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="dashboard-logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Registration Success Message */}
      {location.state?.message && (
        <div className="dashboard-success" role="status">
          {location.state.message}
        </div>
      )}

      {/* Organization Context */}
      <section className="dashboard-context-panel">
        <div className="dashboard-context-details">
          <p className="dashboard-context-label">Current Organization</p>

          <h2 className="dashboard-context-value">
            {selectedOrganizationId
              ? organizationName
              : "No organization selected"}
          </h2>

          {selectedOrganizationId && userRole && (
            <span className="dashboard-role-badge">{formatRole(userRole)}</span>
          )}
        </div>

        {organizations.length > 1 && (
          <div className="dashboard-organization-control">
            <label htmlFor="organization-select">Switch Organization</label>

            <select
              id="organization-select"
              className="dashboard-select"
              value={selectedOrganizationId}
              onChange={(event) =>
                setSelectedOrganizationId(event.target.value)
              }
            >
              <option value="">Choose an organization</option>

              {organizations.map((item) => (
                <option key={item.organization.id} value={item.organization.id}>
                  {item.organization.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {error && (
        <div className="dashboard-alert" role="alert">
          {error}
        </div>
      )}

      {/* Business Overview */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Business Overview</h2>

            <p className="dashboard-section-description">
              An overview of your organization's products.
            </p>
          </div>
        </div>

        {!selectedOrganizationId && (
          <div className="dashboard-empty-state">
            Select an organization to view business statistics.
          </div>
        )}

        {selectedOrganizationId && !productDataReady && (
          <div className="dashboard-empty-state">
            Loading product statistics...
          </div>
        )}

        {productDataReady && productsError && (
          <div className="dashboard-alert" role="alert">
            {productsError}
          </div>
        )}

        {productDataReady && !productsError && (
          <div className="dashboard-stat-grid">
            {userRole !== "sales_staff" && (
              <article className="dashboard-stat-card">
                <p className="dashboard-stat-label">Total Products</p>

                <h3 className="dashboard-stat-value">{products.length}</h3>

                <p className="dashboard-stat-note">
                  Products in your organization
                </p>
              </article>
            )}

            <article className="dashboard-stat-card active">
              <p className="dashboard-stat-label">Active Products</p>

              <h3 className="dashboard-stat-value">{activeProducts}</h3>

              <p className="dashboard-stat-note">Currently active products</p>
            </article>

            {userRole !== "sales_staff" && (
              <article className="dashboard-stat-card inactive">
                <p className="dashboard-stat-label">Inactive Products</p>

                <h3 className="dashboard-stat-value">{inactiveProducts}</h3>

                <p className="dashboard-stat-note">Deactivated products</p>
              </article>
            )}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Quick Actions</h2>

            <p className="dashboard-section-description">
              Quickly access your product management tools.
            </p>
          </div>
        </div>

        <div className="dashboard-actions-grid">
          <Link to="/products" className="dashboard-action-card">
            <div>
              <h3 className="dashboard-action-title">View Products</h3>

              <p className="dashboard-action-description">
                Browse and manage your organization's products.
              </p>
            </div>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          {canCreateProducts && (
            <Link to="/products/new" className="dashboard-action-card">
              <div>
                <h3 className="dashboard-action-title">Add New Product</h3>

                <p className="dashboard-action-description">
                  Add a new product to your organization.
                </p>
              </div>

              <span className="dashboard-action-arrow">→</span>
            </Link>
          )}
        </div>
      </section>

      {/* Recent Products */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2 className="dashboard-section-title">Recent Products</h2>

            <p className="dashboard-section-description">
              The latest products added to your organization.
            </p>
          </div>

          <Link to="/products" className="dashboard-action-arrow">
            View All →
          </Link>
        </div>

        {!selectedOrganizationId && (
          <div className="dashboard-empty-state">
            Select an organization to view its products.
          </div>
        )}

        {selectedOrganizationId && !productDataReady && (
          <div className="dashboard-empty-state">
            Loading recent products...
          </div>
        )}

        {productDataReady && productsError && (
          <div className="dashboard-empty-state">
            Recent products are unavailable.
          </div>
        )}

        {productDataReady && !productsError && recentProducts.length === 0 && (
          <div className="dashboard-empty-state">
            No products have been added yet.
          </div>
        )}

        {productDataReady && !productsError && recentProducts.length > 0 && (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product._id}>
                    <td>{product.name}</td>
                    <td>{product.brand || "—"}</td>
                    <td>{product.category || "—"}</td>
                    <td>
                      <span
                        className={`dashboard-status-badge ${product.status}`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td>{formatDate(product.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
