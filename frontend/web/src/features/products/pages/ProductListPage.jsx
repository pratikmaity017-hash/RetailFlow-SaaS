import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getProducts,
  deactivateProduct,
  reactivateProduct,
} from "../productService";
import { getUserOrganizations } from "../../organization/organizationService";

import "./product-list.css";

export default function ProductListPage() {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deactivatingProductId, setDeactivatingProductId] = useState("");

  // Load organizations available to the authenticated user.
  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        const response = await getUserOrganizations();
        const availableOrganizations = response?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        if (availableOrganizations.length === 1) {
          setSelectedOrganizationId(availableOrganizations[0].organization.id);
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

  // Load products whenever the selected organization changes.
  useEffect(() => {
    if (!selectedOrganizationId) return;

    let isMounted = true;

    async function loadProducts() {
      try {
        setIsProductsLoading(true);
        setError("");

        const response = await getProducts(selectedOrganizationId);

        if (isMounted) {
          setProducts(response?.data?.products || []);
        }
      } catch (err) {
        if (isMounted) {
          setProducts([]);
          setError(err.message || "Unable to load products.");
        }
      } finally {
        if (isMounted) {
          setIsProductsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  // Filter products by search text and status.
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        product.name?.toLowerCase().includes(searchText) ||
        product.brand?.toLowerCase().includes(searchText) ||
        product.category?.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const activeCount = products.filter(
    (product) => product.status === "active",
  ).length;

  const inactiveCount = products.filter(
    (product) => product.status === "inactive",
  ).length;

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const canEditProducts = ["owner", "manager"].includes(
    selectedOrganization?.role,
  );

  const canDeactivateProducts = selectedOrganization?.role === "owner";

  async function handleDeactivateProduct(product) {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${product.name}"?`,
    );

    if (!confirmed) return;

    try {
      setActionError("");
      setDeactivatingProductId(product._id);

      await deactivateProduct(selectedOrganizationId, product._id);

      setProducts((currentProducts) =>
        currentProducts.map((item) =>
          item._id === product._id ? { ...item, status: "inactive" } : item,
        ),
      );
    } catch (err) {
      setActionError(err.message || "Unable to deactivate product.");
    } finally {
      setDeactivatingProductId("");
    }
  }

  async function handleReactivateProduct(product) {
    const confirmed = window.confirm(
      `Are you sure you want to reactivate "${product.name}"?`,
    );

    if (!confirmed) return;

    try {
      setActionError("");
      setDeactivatingProductId(product._id);

      await reactivateProduct(selectedOrganizationId, product._id);

      setProducts((currentProducts) =>
        currentProducts.map((item) =>
          item._id === product._id ? { ...item, status: "active" } : item,
        ),
      );
    } catch (err) {
      setActionError(err.message || "Unable to reactivate product.");
    } finally {
      setDeactivatingProductId("");
    }
  }

  if (isLoading) {
    return (
      <main className="product-page">
        <p className="product-loading">Loading organizations...</p>
      </main>
    );
  }

  return (
    <main className="product-page">
      <header className="product-page-header">
        <div>
          <p className="product-eyebrow">INVENTORY MANAGEMENT</p>
          <h1>Products</h1>
          <p className="product-subtitle">
            Manage and monitor your organization's products.
          </p>
          {selectedOrganization && (
            <div className="product-context-info">
              <p>
                Organization:{" "}
                <strong>{selectedOrganization.organization.name}</strong>
              </p>

              <p>
                Your Role:{" "}
                <strong className="product-role-badge">
                  {selectedOrganization.role
                    .replaceAll("_", " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </strong>
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="product-primary-button"
          onClick={() => navigate("/products/new")}
          disabled={!selectedOrganizationId}
        >
          + Add Product
        </button>
      </header>

      {organizations.length > 1 && (
        <section className="product-organization">
          <label htmlFor="product-organization">Select organization</label>

          <select
            id="product-organization"
            value={selectedOrganizationId}
            onChange={(event) => setSelectedOrganizationId(event.target.value)}
          >
            <option value="">Choose an organization</option>

            {organizations.map((item) => (
              <option key={item.organization.id} value={item.organization.id}>
                {item.organization.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {organizations.length === 0 && (
        <div className="product-alert">
          No active organization is available for your account.
        </div>
      )}

      {error && (
        <div className="product-alert" role="alert">
          {error}
        </div>
      )}

      {actionError && (
        <div className="product-alert" role="alert">
          {actionError}
        </div>
      )}

      {selectedOrganizationId && (
        <>
          <section className="product-stat-grid">
            <article className="product-stat-card">
              <span>Total Products</span>
              <strong>{products.length}</strong>
            </article>

            <article className="product-stat-card">
              <span>Active Products</span>
              <strong>{activeCount}</strong>
            </article>

            <article className="product-stat-card">
              <span>Inactive Products</span>
              <strong>{inactiveCount}</strong>
            </article>
          </section>

          <section className="product-list-card">
            <div className="product-list-toolbar">
              <div>
                <h2>All Products</h2>
                <p>Browse and manage your product catalog.</p>
              </div>

              <div className="product-filters">
                <input
                  type="search"
                  placeholder="Search products..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search products"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by product status"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {isProductsLoading ? (
              <p className="product-loading">Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <div className="product-empty-state">
                <h3>
                  {products.length === 0
                    ? "No products yet"
                    : "No matching products"}
                </h3>

                <p>
                  {products.length === 0
                    ? "Products you add will appear here."
                    : "Try changing your search or status filter."}
                </p>
              </div>
            ) : (
              <div className="product-table-wrapper">
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Created</th>
                      {canEditProducts && <th>Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product._id}>
                        <td>
                          <strong>{product.name}</strong>
                          {product.description && (
                            <small>{product.description}</small>
                          )}

                          <button
                            type="button"
                            className="product-variants-link"
                            onClick={() =>
                              navigate(`/products/${product._id}/variants`)
                            }
                          >
                            Manage Variants →
                          </button>
                        </td>

                        <td>{product.brand || "—"}</td>
                        <td>{product.category || "—"}</td>

                        <td>
                          <span
                            className={`product-status product-status-${product.status}`}
                          >
                            {product.status}
                          </span>
                        </td>

                        <td>
                          {product.createdAt
                            ? new Date(product.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        {canEditProducts && (
                          <td>
                            <div className="product-action-buttons">
                              <button
                                type="button"
                                className="product-edit-button"
                                onClick={() =>
                                  navigate(`/products/${product._id}/edit`)
                                }
                              >
                                Edit
                              </button>

                              {canDeactivateProducts &&
                                product.status === "active" && (
                                  <button
                                    type="button"
                                    className="product-deactivate-button"
                                    onClick={() =>
                                      handleDeactivateProduct(product)
                                    }
                                    disabled={
                                      deactivatingProductId === product._id
                                    }
                                  >
                                    {deactivatingProductId === product._id
                                      ? "Deactivating..."
                                      : "Deactivate"}
                                  </button>
                                )}

                              {canDeactivateProducts &&
                                product.status === "inactive" && (
                                  <button
                                    type="button"
                                    className="product-reactivate-button"
                                    onClick={() =>
                                      handleReactivateProduct(product)
                                    }
                                    disabled={
                                      deactivatingProductId === product._id
                                    }
                                  >
                                    {deactivatingProductId === product._id
                                      ? "Reactivating..."
                                      : "Reactivate"}
                                  </button>
                                )}
                            </div>
                          </td>
                        )}
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
