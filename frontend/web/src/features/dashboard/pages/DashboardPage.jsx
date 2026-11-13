import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import {
  getUserOrganizations,
  getOrganizationContext,
} from "../../organization/organizationService";
import { getProducts } from "../../products/productService";

import "./dashboard.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

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

        if (availableOrganizations.length === 0) {
          setSelectedOrganizationId("");

          localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
          return;
        }

        const savedOrganizationId = localStorage.getItem(
          ORGANIZATION_STORAGE_KEY,
        );

        const savedOrganizationExists = availableOrganizations.some(
          (item) => item.organization.id === savedOrganizationId,
        );

        const organizationId = savedOrganizationExists
          ? savedOrganizationId
          : availableOrganizations[0].organization.id;

        setSelectedOrganizationId(organizationId);

        localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
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

      {location.state?.message && (
        <div className="dashboard-success" role="status">
          {location.state.message}
        </div>
      )}

      {error && (
        <div className="dashboard-alert" role="alert">
          {error}
        </div>
      )}

      {/* Organization Empty State */}
      {!error && organizations.length === 0 && (
        <section className="dashboard-onboarding-empty">
          <div className="dashboard-onboarding-content">
            <span className="dashboard-onboarding-icon" aria-hidden="true">
              +
            </span>

            <p className="dashboard-eyebrow">YOUR WORKSPACE</p>

            <h2>Let's set up your business</h2>

            <p>
              You haven't created or joined an organization yet. Create your
              business workspace to start managing products and retail
              operations with RetailFlow.
            </p>

            <Link
              to="/organizations/new"
              className="dashboard-onboarding-button"
            >
              Create your organization
              <span aria-hidden="true">→</span>
            </Link>

            <span className="dashboard-onboarding-note">
              You can also create your organization later.
            </span>
          </div>
        </section>
      )}

      {/* Organization Dashboard */}
      {organizations.length > 0 && (
        <>
          <section className="dashboard-context-panel">
            <div className="dashboard-workspace-info">
              <div className="dashboard-workspace-icon" aria-hidden="true">
                <span>R</span>
              </div>

              <div className="dashboard-context-details">
                <p className="dashboard-context-label">ACTIVE WORKSPACE</p>

                <h2 className="dashboard-context-value">
                  {selectedOrganizationId
                    ? organizationName
                    : "No organization selected"}
                </h2>

                <div className="dashboard-workspace-meta">
                  {selectedOrganizationId && userRole && (
                    <span className="dashboard-role-badge">
                      {formatRole(userRole)}
                    </span>
                  )}

                  {selectedOrganizationId && (
                    <span className="dashboard-workspace-status">
                      <span className="dashboard-status-dot" />
                      Active workspace
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-workspace-actions">
              {organizations.length > 1 && (
                <div className="dashboard-organization-control">
                  <label htmlFor="organization-select">Switch workspace</label>

                  <select
                    id="organization-select"
                    className="dashboard-select"
                    value={selectedOrganizationId}
                    onChange={(event) => {
                      const organizationId = event.target.value;

                      setSelectedOrganizationId(organizationId);

                      if (organizationId) {
                        localStorage.setItem(
                          ORGANIZATION_STORAGE_KEY,
                          organizationId,
                        );
                      } else {
                        localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
                      }
                    }}
                  >
                    <option value="">Choose an organization</option>

                    {organizations.map((item) => (
                      <option
                        key={item.organization.id}
                        value={item.organization.id}
                      >
                        {item.organization.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Link
                to="/organizations/new"
                className="dashboard-create-organization-button"
              >
                <span aria-hidden="true">+</span>
                Create Organization
              </Link>
            </div>
          </section>

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
                  <p className="dashboard-stat-note">
                    Currently active products
                  </p>
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

            {productDataReady &&
              !productsError &&
              recentProducts.length === 0 && (
                <div className="dashboard-empty-state">
                  No products have been added yet.
                </div>
              )}

            {productDataReady &&
              !productsError &&
              recentProducts.length > 0 && (
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
        </>
      )}
    </main>
  );
}
