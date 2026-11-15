import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getUserOrganizations } from "../../organization/organizationService";
import { getProducts, getProductVariants } from "../../products/productService";

import {
  getVariantInventory,
  adjustStock,
  getStockMovements,
} from "../inventoryService";

import Skeleton from "../../../shared/components/Skeleton";

import "./inventory.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

const initialForm = {
  type: "stock_in",
  quantity: "",
  reason: "",
};

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

export default function StockAdjustmentPage() {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");

  const [inventory, setInventory] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isVariantsLoading, setIsVariantsLoading] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [movements, setMovements] = useState([]);
  const [movementPagination, setMovementPagination] = useState(null);
  const [movementPage, setMovementPage] = useState(1);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [movementRefreshKey, setMovementRefreshKey] = useState(0);
  const [newMovementId, setNewMovementId] = useState(null);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        const response = await getUserOrganizations();
        const availableOrganizations = response?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        const savedId = localStorage.getItem(ORGANIZATION_STORAGE_KEY);

        const savedExists = availableOrganizations.some(
          (item) => item.organization.id === savedId,
        );

        const organizationId = savedExists
          ? savedId
          : availableOrganizations[0]?.organization.id || "";

        setSelectedOrganizationId(organizationId);

        if (organizationId) {
          localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
        } else {
          localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, "Unable to load organizations."));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOrganizations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedOrganizationId) {
      setProducts([]);
      setSelectedProductId("");
      return;
    }

    let isMounted = true;

    async function loadProducts() {
      try {
        setIsProductsLoading(true);
        setError("");
        setProducts([]);
        setVariants([]);
        setSelectedProductId("");
        setSelectedVariantId("");
        setInventory(null);

        const response = await getProducts(selectedOrganizationId);
        const availableProducts = response?.data?.products || [];

        if (isMounted) {
          setProducts(
            availableProducts.filter((product) => product.status === "active"),
          );
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, "Unable to load products."));
        }
      } finally {
        if (isMounted) setIsProductsLoading(false);
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId || !selectedProductId) {
      setVariants([]);
      setSelectedVariantId("");
      setInventory(null);
      return;
    }

    let isMounted = true;

    async function loadVariants() {
      try {
        setIsVariantsLoading(true);
        setVariants([]);
        setSelectedVariantId("");
        setInventory(null);
        setError("");

        const response = await getProductVariants(
          selectedOrganizationId,
          selectedProductId,
        );

        const availableVariants = response?.data?.variants || [];

        if (isMounted) {
          setVariants(
            availableVariants.filter((variant) => variant.status === "active"),
          );
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, "Unable to load variants."));
        }
      } finally {
        if (isMounted) setIsVariantsLoading(false);
      }
    }

    loadVariants();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId, selectedProductId]);

  useEffect(() => {
    if (!selectedOrganizationId || !selectedProductId || !selectedVariantId) {
      setInventory(null);
      return;
    }

    let isMounted = true;

    async function loadInventory() {
      try {
        setIsInventoryLoading(true);
        setInventory(null);
        setError("");
        setFormError("");
        setSuccessMessage("");

        const response = await getVariantInventory(
          selectedOrganizationId,
          selectedProductId,
          selectedVariantId,
        );

        if (isMounted) {
          setInventory(response?.data || null);
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, "Unable to load current stock."));
        }
      } finally {
        if (isMounted) setIsInventoryLoading(false);
      }
    }

    loadInventory();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId, selectedProductId, selectedVariantId]);

  useEffect(() => {
    if (!selectedOrganizationId || !selectedProductId || !selectedVariantId) {
      setMovements([]);
      setMovementPagination(null);
      return;
    }

    let isMounted = true;

    async function loadMovements() {
      try {
        setIsMovementsLoading(true);
        setMovementError("");

        const response = await getStockMovements(
          selectedOrganizationId,
          selectedProductId,
          selectedVariantId,
          movementPage,
          20,
        );

        if (isMounted) {
          setMovements(response?.data?.movements || []);
          setMovementPagination(response?.data?.pagination || null);
        }
      } catch (err) {
        if (isMounted) {
          setMovementError(
            getErrorMessage(err, "Unable to load stock movement history."),
          );
        }
      } finally {
        if (isMounted) {
          setIsMovementsLoading(false);
        }
      }
    }

    loadMovements();

    return () => {
      isMounted = false;
    };
  }, [
    selectedOrganizationId,
    selectedProductId,
    selectedVariantId,
    movementPage,
    movementRefreshKey,
  ]);

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const canAdjustStock = ["owner", "manager"].includes(
    selectedOrganization?.role,
  );

  const selectedProduct = products.find(
    (product) => product._id === selectedProductId,
  );

  const selectedVariant = variants.find(
    (variant) => variant._id === selectedVariantId,
  );

  function handleOrganizationChange(event) {
    const organizationId = event.target.value;

    setSelectedOrganizationId(organizationId);
    localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);

    setForm(initialForm);
    setError("");
    setFormError("");
    setSuccessMessage("");
  }

  function handleProductChange(event) {
    setSelectedProductId(event.target.value);
    setForm(initialForm);
    setError("");
    setFormError("");
    setSuccessMessage("");
  }

  function handleVariantChange(event) {
    setSelectedVariantId(event.target.value);
    setForm(initialForm);
    setError("");
    setFormError("");
    setSuccessMessage("");
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormError("");
    setSuccessMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    if (!canAdjustStock) {
      setFormError("Only Owners and Managers can adjust stock.");
      return;
    }

    if (!selectedProductId || !selectedVariantId) {
      setFormError("Select a product and variant first.");
      return;
    }

    const quantity = Number(form.quantity);
    const reason = form.reason.trim();

    if (!Number.isFinite(quantity) || quantity < 0) {
      setFormError("Enter a valid non-negative quantity.");
      return;
    }

    if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7) {
      setFormError("Quantity can have at most 3 decimal places.");
      return;
    }

    if (form.type !== "adjustment" && quantity <= 0) {
      setFormError(
        "Quantity must be greater than zero for Stock In and Stock Out.",
      );
      return;
    }

    if (reason.length < 3 || reason.length > 500) {
      setFormError("Reason must contain 3 to 500 characters.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await adjustStock(
        selectedOrganizationId,
        selectedProductId,
        selectedVariantId,
        {
          type: form.type,
          quantity,
          reason,
        },
      );

      const updatedInventory = response?.data?.inventory;

      const newMovement = response?.data?.movement;

      if (!newMovement) {
        throw new Error("Stock adjusted, but movement response was missing.");
      }

      setNewMovementId(newMovement._id);

      // Fetch latest movements with populated user details.
      setMovementPage(1);

      try {
        const movementResponse = await getStockMovements(
          selectedOrganizationId,
          selectedProductId,
          selectedVariantId,
          1,
          20,
        );

        setMovements(movementResponse?.data?.movements || []);

        setMovementPagination(movementResponse?.data?.pagination || null);
      } catch (movementError) {
        // Keep the successful stock adjustment even if history refresh fails.
        setMovements((previous) => [newMovement, ...previous].slice(0, 20));

        setMovementError(
          getErrorMessage(movementError, "Unable to refresh movement history."),
        );
      }

      if (!updatedInventory) {
        throw new Error("Stock was adjusted, but the response was invalid.");
      }

      setInventory((previous) => ({
        ...previous,
        inventory: updatedInventory,
        quantity: updatedInventory.quantity,
        lowStockThreshold: updatedInventory.lowStockThreshold,
        isLowStock:
          updatedInventory.quantity <= updatedInventory.lowStockThreshold,
      }));

      setSuccessMessage(response?.message || "Stock adjusted successfully.");

      setForm(initialForm);
    } catch (err) {
      setFormError(getErrorMessage(err, "Unable to adjust stock."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="inventory-page inventory-skeleton-page">
        <header className="inventory-page-header">
          <div className="inventory-skeleton-heading">
            <Skeleton width="130px" height="12px" />
            <Skeleton width="210px" height="32px" />
            <Skeleton width="320px" height="16px" />
          </div>
          <Skeleton width="145px" height="42px" />
        </header>

        <section className="inventory-adjustment-card">
          <div className="inventory-section-heading">
            <div className="inventory-skeleton-heading">
              <Skeleton width="180px" height="22px" />
              <Skeleton width="260px" height="14px" />
            </div>
          </div>

          <div className="inventory-adjustment-skeleton-grid">
            <div>
              <Skeleton width="65px" height="14px" />
              <Skeleton width="100%" height="44px" />
            </div>
            <div>
              <Skeleton width="110px" height="14px" />
              <Skeleton width="100%" height="44px" />
            </div>
          </div>
        </section>

        <section className="inventory-adjustment-card">
          <Skeleton width="130px" height="22px" />
          <div className="inventory-current-stock inventory-current-stock-skeleton">
            <div>
              <Skeleton width="130px" height="13px" />
              <Skeleton width="75px" height="28px" />
            </div>
            <div>
              <Skeleton width="130px" height="13px" />
              <Skeleton width="75px" height="28px" />
            </div>
            <Skeleton width="105px" height="32px" />
          </div>
        </section>

        <section className="inventory-adjustment-card">
          <Skeleton width="130px" height="22px" />
          <div className="inventory-adjustment-skeleton">
            <div className="inventory-adjustment-skeleton-grid">
              <div>
                <Skeleton width="120px" height="14px" />
                <Skeleton width="100%" height="44px" />
              </div>
              <div>
                <Skeleton width="90px" height="14px" />
                <Skeleton width="100%" height="44px" />
              </div>
              <div className="inventory-adjustment-skeleton-full">
                <Skeleton width="70px" height="14px" />
                <Skeleton width="100%" height="100px" />
              </div>
            </div>
          </div>
        </section>

        <section className="inventory-adjustment-card">
          <Skeleton width="190px" height="22px" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="inventory-skeleton-row" key={index}>
              <Skeleton width="12%" height="16px" />
              <Skeleton width="12%" height="16px" />
              <Skeleton width="14%" height="16px" />
              <Skeleton width="14%" height="16px" />
              <Skeleton width="18%" height="16px" />
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="inventory-page">
      <header className="inventory-page-header">
        <div>
          <p className="inventory-eyebrow">STOCK CONTROL</p>
          <h1>Stock Adjustment</h1>
          <p className="inventory-subtitle">
            Add stock, remove stock or correct the actual stock quantity.
          </p>
        </div>

        <button
          type="button"
          className="inventory-secondary-button"
          onClick={() => navigate("/inventory")}
        >
          Back to Inventory
        </button>
      </header>

      {error && (
        <div className="inventory-alert" role="alert">
          {error}
        </div>
      )}

      <section className="inventory-adjustment-card">
        <div className="inventory-section-heading">
          <div>
            <h2>Select Product Variant</h2>
            <p>
              Choose the organization, product and variant whose stock you want
              to manage.
            </p>
          </div>
        </div>

        <div className="inventory-form-grid">
          <label>
            Organization
            <select
              value={selectedOrganizationId}
              onChange={handleOrganizationChange}
            >
              {organizations.map((item) => (
                <option key={item.organization.id} value={item.organization.id}>
                  {item.organization.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Product
            <select
              value={selectedProductId}
              onChange={handleProductChange}
              disabled={!selectedOrganizationId || isProductsLoading}
            >
              {isProductsLoading && (
                <div style={{ marginTop: "8px" }}>
                  <Skeleton width="100%" height="40px" />
                </div>
              )}
              <option value="">
                {isProductsLoading ? "Loading products..." : "Select product"}
              </option>

              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Product Variant
            <select
              value={selectedVariantId}
              onChange={handleVariantChange}
              disabled={!selectedProductId || isVariantsLoading}
            >
              {isVariantsLoading && (
                <div style={{ marginTop: "8px" }}>
                  <Skeleton width="100%" height="40px" />
                </div>
              )}
              <option value="">
                {isVariantsLoading ? "Loading variants..." : "Select variant"}
              </option>

              {variants.map((variant) => (
                <option key={variant._id} value={variant._id}>
                  {variant.sku}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedOrganization && (
          <p className="inventory-role-note">
            Your role:{" "}
            <strong>{selectedOrganization.role.replaceAll("_", " ")}</strong>
          </p>
        )}

        {selectedProduct && selectedVariant && (
          <div className="inventory-selected-variant">
            <span>Selected variant</span>
            <strong>{selectedProduct.name}</strong>
            <p>
              SKU: {selectedVariant.sku}
              {selectedVariant.barcode
                ? ` · Barcode: ${selectedVariant.barcode}`
                : ""}
            </p>
          </div>
        )}
      </section>

      {selectedVariantId && (
        <section className="inventory-adjustment-card">
          <div className="inventory-section-heading">
            <div>
              <h2>Current Stock</h2>
              <p>Latest inventory quantity for this variant.</p>
            </div>
          </div>

          {isInventoryLoading ? (
            <div className="inventory-current-stock inventory-current-stock-skeleton">
              <div>
                <Skeleton width="130px" height="13px" />
                <Skeleton width="75px" height="28px" />
              </div>

              <div>
                <Skeleton width="130px" height="13px" />
                <Skeleton width="75px" height="28px" />
              </div>

              <Skeleton width="105px" height="32px" />
            </div>
          ) : inventory ? (
            <div className="inventory-current-stock">
              <div>
                <span>Available Quantity</span>
                <strong>{inventory.quantity}</strong>
              </div>

              <div>
                <span>Low Stock Threshold</span>
                <strong>{inventory.lowStockThreshold}</strong>
              </div>

              <span
                className={
                  inventory.isLowStock
                    ? "inventory-status-low"
                    : "inventory-status-good"
                }
              >
                {inventory.isLowStock ? "Low Stock" : "Stock Healthy"}
              </span>
            </div>
          ) : null}
        </section>
      )}

      {selectedVariantId && (
        <section className="inventory-adjustment-card">
          <div className="inventory-section-heading">
            <div>
              <h2>Adjust Stock</h2>
              <p>Select an operation and enter the quantity and reason.</p>
            </div>
          </div>

          {isInventoryLoading ? (
            <div className="inventory-adjustment-skeleton">
              <div className="inventory-adjustment-skeleton-grid">
                <div>
                  <Skeleton width="120px" height="14px" />
                  <Skeleton width="100%" height="44px" />
                </div>

                <div>
                  <Skeleton width="90px" height="14px" />
                  <Skeleton width="100%" height="44px" />
                </div>

                <div className="inventory-adjustment-skeleton-full">
                  <Skeleton width="70px" height="14px" />
                  <Skeleton width="100%" height="100px" />
                </div>
              </div>

              <div className="inventory-form-actions">
                <Skeleton width="100px" height="42px" />
                <Skeleton width="130px" height="42px" />
              </div>
            </div>
          ) : !canAdjustStock ? (
            <div className="inventory-alert" role="alert">
              Your organization role does not allow stock adjustments. Only
              Owners and Managers can perform this action.
            </div>
          ) : (
            <form className="inventory-adjustment-form" onSubmit={handleSubmit}>
              {formError && (
                <div className="inventory-alert" role="alert">
                  {formError}
                </div>
              )}

              {successMessage && (
                <div className="inventory-success" role="status">
                  {successMessage}
                </div>
              )}

              <div className="inventory-form-grid">
                <label>
                  Adjustment Type
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleFormChange}
                    disabled={isSubmitting}
                  >
                    <option value="stock_in">Stock In</option>
                    <option value="stock_out">Stock Out</option>
                    <option value="adjustment">Set Actual Quantity</option>
                  </select>
                </label>

                <label>
                  {form.type === "adjustment"
                    ? "Actual Stock Quantity"
                    : "Quantity"}
                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    step="0.001"
                    max="1000000000"
                    value={form.quantity}
                    onChange={handleFormChange}
                    placeholder="Enter quantity"
                    required
                    disabled={isSubmitting}
                  />
                </label>

                <label className="inventory-form-full">
                  Reason
                  <textarea
                    name="reason"
                    value={form.reason}
                    onChange={handleFormChange}
                    placeholder="e.g. New stock received from supplier"
                    minLength={3}
                    maxLength={500}
                    rows={4}
                    required
                    disabled={isSubmitting}
                  />
                </label>
              </div>

              {form.type === "adjustment" && (
                <p className="inventory-form-help">
                  Enter the final physical stock quantity, not the difference.
                  For example, if current stock is 10 and actual stock is 7,
                  enter 7.
                </p>
              )}

              <div className="inventory-form-actions">
                <button
                  type="button"
                  className="inventory-secondary-button"
                  disabled={isSubmitting}
                  onClick={() => setForm(initialForm)}
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="inventory-primary-button"
                  disabled={isSubmitting || !inventory}
                >
                  {isSubmitting ? "Updating Stock..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {selectedVariantId && inventory && (
        <section className="inventory-adjustment-card">
          <div className="inventory-section-heading">
            <div>
              <h2>Stock Movement History</h2>
              <p>Track all stock changes for this product variant.</p>
            </div>
          </div>

          {movementError && (
            <div className="inventory-alert" role="alert">
              {movementError}
            </div>
          )}

          {isMovementsLoading ? (
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Quantity</th>
                    <th>Previous Stock</th>
                    <th>New Stock</th>
                    <th>Reason</th>
                    <th>Performed By</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td>
                        <Skeleton width="75px" height="16px" />
                      </td>
                      <td>
                        <Skeleton width="45px" height="16px" />
                      </td>
                      <td>
                        <Skeleton width="55px" height="16px" />
                      </td>
                      <td>
                        <Skeleton width="55px" height="16px" />
                      </td>
                      <td>
                        <Skeleton width="110px" height="16px" />
                      </td>
                      <td>
                        <Skeleton width="90px" height="16px" />
                      </td>
                      <td>
                        <Skeleton width="120px" height="16px" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : movements.length === 0 ? (
            <div className="inventory-empty-state">
              <h3>No stock movements yet</h3>
              <p>Stock adjustment records will appear here.</p>
            </div>
          ) : (
            <>
              <div className="inventory-table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Operation</th>
                      <th>Quantity</th>
                      <th>Previous Stock</th>
                      <th>New Stock</th>
                      <th>Reason</th>
                      <th>Performed By</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {isSubmitting && (
                      <tr className="inventory-movement-skeleton-row">
                        <td>
                          <span className="inventory-skeleton-line short" />
                        </td>
                        <td>
                          <span className="inventory-skeleton-line" />
                        </td>
                        <td>
                          <span className="inventory-skeleton-line" />
                        </td>
                        <td>
                          <span className="inventory-skeleton-line" />
                        </td>
                        <td>
                          <span className="inventory-skeleton-line long" />
                        </td>
                        <td>
                          <span className="inventory-skeleton-line" />
                        </td>
                        <td>
                          <span className="inventory-skeleton-line long" />
                        </td>
                      </tr>
                    )}

                    {movements.map((movement) => (
                      <tr
                        key={movement._id}
                        className={
                          movement._id === newMovementId
                            ? "inventory-movement-row-new"
                            : ""
                        }
                      >
                        <td>
                          <span
                            className={`inventory-movement-type ${movement.type}`}
                          >
                            {movement.type.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>{movement.quantity}</td>
                        <td>{movement.previousQuantity}</td>
                        <td>{movement.newQuantity}</td>
                        <td>{movement.reason}</td>
                        <td>{movement.performedBy?.name || "Unknown"}</td>
                        <td>{new Date(movement.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {movementPagination && movementPagination.totalPages > 1 && (
                <div className="inventory-pagination">
                  <span>
                    Page {movementPagination.currentPage} of{" "}
                    {movementPagination.totalPages}
                  </span>

                  <div>
                    <button
                      type="button"
                      className="inventory-secondary-button"
                      disabled={movementPage <= 1}
                      onClick={() => setMovementPage((page) => page - 1)}
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      className="inventory-secondary-button"
                      disabled={movementPage >= movementPagination.totalPages}
                      onClick={() => setMovementPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {selectedOrganizationId &&
        !isProductsLoading &&
        products.length === 0 && (
          <div className="inventory-empty-state">
            <h3>No active products found</h3>
            <p>
              Create a product and at least one active variant before adjusting
              stock.
            </p>
            <button
              type="button"
              className="inventory-primary-button"
              onClick={() => navigate("/products")}
            >
              Go to Products
            </button>
          </div>
        )}
    </main>
  );
}
