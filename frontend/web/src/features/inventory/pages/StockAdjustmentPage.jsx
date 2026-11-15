import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getUserOrganizations } from "../../organization/organizationService";
import { getProducts, getProductVariants } from "../../products/productService";

import { getVariantInventory, adjustStock } from "../inventoryService";

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
      <main className="inventory-page">
        <p className="inventory-loading">Loading organizations...</p>
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
            <p className="inventory-loading">Loading current stock...</p>
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

      {selectedVariantId && !isInventoryLoading && inventory && (
        <section className="inventory-adjustment-card">
          <div className="inventory-section-heading">
            <div>
              <h2>Adjust Stock</h2>
              <p>Select an operation and enter the quantity and reason.</p>
            </div>
          </div>

          {!canAdjustStock ? (
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
