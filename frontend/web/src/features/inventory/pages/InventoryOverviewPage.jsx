import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserOrganizations } from "../../organization/organizationService";
import { getProducts, getProductVariants } from "../../products/productService";
import {
  getVariantInventory,
  getLowStockInventory,
  adjustStock,
} from "../inventoryService";

import "./inventory.css";
import Skeleton from "../../../shared/components/Skeleton";

const initialAdjustmentForm = {
  type: "stock_in",
  quantity: "",
  reason: "",
};

function getAdjustmentError(error) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.message ||
    "Unable to adjust stock."
  );
}

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

export default function InventoryOverviewPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const [inventoryItems, setInventoryItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [adjustmentItem, setAdjustmentItem] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState(initialAdjustmentForm);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState("");
  const [adjustmentSuccess, setAdjustmentSuccess] = useState("");

  const canAdjustStock = ["owner", "manager"].includes(
    selectedOrganization?.role,
  );

  function openAdjustmentModal(item) {
    if (!canAdjustStock) return;

    setAdjustmentItem(item);
    setAdjustmentForm(initialAdjustmentForm);
    setAdjustmentError("");
    setAdjustmentSuccess("");
    setIsAdjustmentOpen(true);
  }

  function closeAdjustmentModal() {
    if (isAdjusting) return;

    setIsAdjustmentOpen(false);
    setAdjustmentItem(null);
    setAdjustmentForm(initialAdjustmentForm);
    setAdjustmentError("");
    setAdjustmentSuccess("");
  }

  function handleAdjustmentFormChange(event) {
    const { name, value } = event.target;

    setAdjustmentForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setAdjustmentError("");
    setAdjustmentSuccess("");
  }

  async function handleQuickAdjustment(event) {
    event.preventDefault();

    if (!canAdjustStock || !adjustmentItem) return;

    const quantity = Number(adjustmentForm.quantity);
    const reason = adjustmentForm.reason.trim();

    if (!Number.isFinite(quantity) || quantity < 0) {
      setAdjustmentError("Enter a valid non-negative quantity.");
      return;
    }

    if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7) {
      setAdjustmentError("Quantity can have at most 3 decimal places.");
      return;
    }

    if (adjustmentForm.type !== "adjustment" && quantity <= 0) {
      setAdjustmentError("Quantity must be greater than zero.");
      return;
    }

    if (reason.length < 3 || reason.length > 500) {
      setAdjustmentError("Reason must contain 3 to 500 characters.");
      return;
    }

    try {
      setIsAdjusting(true);
      setAdjustmentError("");
      setAdjustmentSuccess("");

      const response = await adjustStock(
        selectedOrganizationId,
        adjustmentItem.product._id,
        adjustmentItem.variant._id,
        {
          type: adjustmentForm.type,
          quantity,
          reason,
        },
      );

      const updatedInventory = response?.data?.inventory;

      if (!updatedInventory) {
        throw new Error("Stock was adjusted, but the response was invalid.");
      }

      const updatedItem = {
        ...adjustmentItem,
        inventory: updatedInventory,
        quantity: updatedInventory.quantity,
        lowStockThreshold: updatedInventory.lowStockThreshold,
        isLowStock:
          updatedInventory.quantity <= updatedInventory.lowStockThreshold,
      };

      setInventoryItems((previous) =>
        previous.map((item) =>
          item.variant._id === adjustmentItem.variant._id ? updatedItem : item,
        ),
      );

      setAdjustmentSuccess(response?.message || "Stock adjusted successfully.");

      // Refresh the Low Stock Items section without affecting
      // the successful adjustment if this secondary request fails.
      try {
        const lowStockResponse = await getLowStockInventory(
          selectedOrganizationId,
          1,
          100,
        );

        setLowStockItems(lowStockResponse?.data?.inventory || []);
      } catch {
        // The main inventory table has already been updated.
      }

      setTimeout(() => {
        setIsAdjustmentOpen(false);
        setAdjustmentItem(null);
        setAdjustmentForm(initialAdjustmentForm);
        setAdjustmentSuccess("");
      }, 700);
    } catch (error) {
      setAdjustmentError(getAdjustmentError(error));
    } finally {
      setIsAdjusting(false);
    }
  }

  // Load organizations and restore the previously selected organization.
  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
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

  // Load products, variants and their inventory for the selected organization.
  useEffect(() => {
    if (!selectedOrganizationId) {
      setInventoryItems([]);
      setLowStockItems([]);
      return;
    }

    let isMounted = true;

    async function loadInventory() {
      try {
        setIsInventoryLoading(true);
        setError("");
        setInventoryItems([]);
        setLowStockItems([]);

        const productResponse = await getProducts(selectedOrganizationId);
        const products = (productResponse?.data?.products || []).filter(
          (product) => product.status === "active",
        );

        const productResults = await Promise.all(
          products.map(async (product) => {
            const variantResponse = await getProductVariants(
              selectedOrganizationId,
              product._id,
            );

            const variants = (variantResponse?.data?.variants || []).filter(
              (variant) => variant.status === "active",
            );

            return { product, variants };
          }),
        );

        const variantTasks = productResults.flatMap(({ product, variants }) =>
          variants.map(async (variant) => {
            const response = await getVariantInventory(
              selectedOrganizationId,
              product._id,
              variant._id,
            );

            return {
              product,
              variant,
              inventory: response?.data?.inventory || null,
              quantity: response?.data?.quantity ?? 0,
              lowStockThreshold: response?.data?.lowStockThreshold ?? 5,
              isLowStock: response?.data?.isLowStock ?? true,
            };
          }),
        );

        const results = await Promise.all(variantTasks);

        const lowStockResponse = await getLowStockInventory(
          selectedOrganizationId,
          1,
          100,
        );

        if (!isMounted) return;

        setInventoryItems(results);
        setLowStockItems(lowStockResponse?.data?.inventory || []);
      } catch (err) {
        if (isMounted) {
          setInventoryItems([]);
          setLowStockItems([]);
          setError(err.message || "Unable to load inventory.");
        }
      } finally {
        if (isMounted) {
          setIsInventoryLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  const filteredItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        item.product.name?.toLowerCase().includes(searchText) ||
        item.product.brand?.toLowerCase().includes(searchText) ||
        item.variant.sku?.toLowerCase().includes(searchText) ||
        item.variant.barcode?.toLowerCase().includes(searchText);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && item.isLowStock) ||
        (stockFilter === "available" && !item.isLowStock);

      return matchesSearch && matchesStock;
    });
  }, [inventoryItems, search, stockFilter]);

  const totalVariants = inventoryItems.length;

  const totalStock = inventoryItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const lowStockCount = inventoryItems.filter((item) => item.isLowStock).length;

  if (isLoading) {
    return (
      <main className="inventory-page inventory-skeleton-page">
        <header className="inventory-page-header">
          <div className="inventory-skeleton-heading">
            <Skeleton width="110px" height="12px" />
            <Skeleton width="180px" height="32px" />
            <Skeleton width="300px" height="14px" />
            <Skeleton width="220px" height="14px" />
          </div>

          <Skeleton width="150px" height="40px" />
        </header>

        <section className="inventory-stat-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <article className="inventory-stat-card" key={index}>
              <Skeleton width="120px" height="14px" />
              <Skeleton width="70px" height="30px" />
            </article>
          ))}
        </section>

        <section className="inventory-list-card">
          <div className="inventory-list-toolbar">
            <div className="inventory-skeleton-heading">
              <Skeleton width="160px" height="22px" />
              <Skeleton width="240px" height="14px" />
            </div>
            <Skeleton width="180px" height="38px" />
          </div>

          <div className="inventory-skeleton-table">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="inventory-skeleton-row" key={index}>
                <Skeleton width="20%" height="16px" />
                <Skeleton width="15%" height="16px" />
                <Skeleton width="15%" height="16px" />
                <Skeleton width="12%" height="16px" />
                <Skeleton width="15%" height="16px" />
              </div>
            ))}
          </div>
        </section>

        <section className="inventory-list-card">
          <div className="inventory-list-toolbar">
            <div className="inventory-skeleton-heading">
              <Skeleton width="150px" height="22px" />
              <Skeleton width="230px" height="14px" />
            </div>
            <Skeleton width="70px" height="24px" />
          </div>

          <div className="inventory-skeleton-table">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="inventory-skeleton-row" key={index}>
                <Skeleton width="25%" height="16px" />
                <Skeleton width="20%" height="16px" />
                <Skeleton width="15%" height="16px" />
                <Skeleton width="15%" height="16px" />
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="inventory-page">
      <header className="inventory-page-header">
        <div>
          <p className="inventory-eyebrow">STOCK CONTROL</p>
          <h1>Inventory</h1>
          <p className="inventory-subtitle">
            Monitor stock levels and track inventory across your organization.
          </p>

          {selectedOrganization && (
            <div className="inventory-context">
              Organization:{" "}
              <strong>{selectedOrganization.organization.name}</strong>
              <span>
                Your Role:{" "}
                <strong>
                  {selectedOrganization.role
                    .replaceAll("_", " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </strong>
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="inventory-secondary-button"
          onClick={() => navigate("/inventory/adjustments")}
        >
          View Stock History
        </button>
      </header>

      {organizations.length > 1 && (
        <section className="inventory-organization">
          <label htmlFor="inventory-organization">Select organization</label>

          <select
            id="inventory-organization"
            value={selectedOrganizationId}
            onChange={(event) => {
              const organizationId = event.target.value;

              setSelectedOrganizationId(organizationId);

              if (organizationId) {
                localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
              } else {
                localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
              }
            }}
          >
            {organizations.map((item) => (
              <option key={item.organization.id} value={item.organization.id}>
                {item.organization.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {organizations.length === 0 && (
        <div className="inventory-alert">
          No active organization is available for your account.
        </div>
      )}

      {error && (
        <div className="inventory-alert" role="alert">
          {error}
        </div>
      )}

      {selectedOrganizationId && (
        <>
          <section className="inventory-stat-grid">
            <article className="inventory-stat-card">
              {isInventoryLoading ? (
                <>
                  <Skeleton width="120px" height="14px" />
                  <Skeleton width="70px" height="30px" />
                </>
              ) : (
                <>
                  <span>Tracked Variants</span>
                  <strong>{totalVariants}</strong>
                </>
              )}
            </article>

            <article className="inventory-stat-card">
              {isInventoryLoading ? (
                <>
                  <Skeleton width="120px" height="14px" />
                  <Skeleton width="70px" height="30px" />
                </>
              ) : (
                <>
                  <span>Total Stock Units</span>
                  <strong>{totalStock.toLocaleString()}</strong>
                </>
              )}
            </article>

            <article className="inventory-stat-card">
              {isInventoryLoading ? (
                <>
                  <Skeleton width="120px" height="14px" />
                  <Skeleton width="70px" height="30px" />
                </>
              ) : (
                <>
                  <span>Low Stock Variants</span>
                  <strong>{lowStockCount}</strong>
                </>
              )}
            </article>
          </section>

          <section className="inventory-list-card">
            <div className="inventory-list-toolbar">
              <div>
                <h2>Stock Overview</h2>
                <p>Current stock levels for active product variants.</p>
              </div>

              <div className="inventory-filters">
                <input
                  type="search"
                  placeholder="Search product, SKU or barcode..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search inventory"
                />

                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                  aria-label="Filter inventory by stock status"
                >
                  <option value="all">All Stock</option>
                  <option value="low">Low Stock</option>
                  <option value="available">Available Stock</option>
                </select>
              </div>
            </div>

            {isInventoryLoading ? (
              <div className="inventory-skeleton-table">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="inventory-skeleton-row" key={index}>
                    <Skeleton width="20%" height="16px" />
                    <Skeleton width="15%" height="16px" />
                    <Skeleton width="15%" height="16px" />
                    <Skeleton width="12%" height="16px" />
                    <Skeleton width="15%" height="16px" />
                    {canAdjustStock && <Skeleton width="12%" height="32px" />}
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="inventory-empty-state">
                <h3>
                  {inventoryItems.length === 0
                    ? "No inventory to display"
                    : "No matching inventory"}
                </h3>
                <p>
                  {inventoryItems.length === 0
                    ? "Active product variants will appear here."
                    : "Try changing your search or stock filter."}
                </p>
              </div>
            ) : (
              <div className="inventory-table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Barcode</th>
                      <th>Quantity</th>
                      <th>Low Stock At</th>
                      <th>Stock Status</th>
                      {canAdjustStock && <th>Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.variant._id}>
                        <td>
                          <strong>{item.product.name}</strong>
                          {item.product.brand && (
                            <small>{item.product.brand}</small>
                          )}
                        </td>

                        <td>{item.variant.sku}</td>
                        <td>{item.variant.barcode || "—"}</td>
                        <td>
                          <strong>{item.quantity}</strong>
                        </td>
                        <td>{item.lowStockThreshold}</td>
                        <td>
                          <span
                            className={`inventory-status ${
                              item.isLowStock ? "low" : "available"
                            }`}
                          >
                            {item.isLowStock ? "Low Stock" : "In Stock"}
                          </span>
                        </td>
                        {canAdjustStock && (
                          <td>
                            <button
                              type="button"
                              className="inventory-quick-adjust-button"
                              onClick={() => openAdjustmentModal(item)}
                            >
                              Adjust Stock
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="inventory-list-card inventory-low-stock-card">
            <div className="inventory-list-toolbar">
              <div>
                <h2>Low Stock Items</h2>
                <p>Products that have reached their stock threshold.</p>
              </div>

              <span className="inventory-low-stock-count">
                {lowStockItems.length} items
              </span>
            </div>

            {isInventoryLoading ? (
              <div className="inventory-skeleton-table">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="inventory-skeleton-row" key={index}>
                    <Skeleton width="25%" height="16px" />
                    <Skeleton width="20%" height="16px" />
                    <Skeleton width="15%" height="16px" />
                    <Skeleton width="15%" height="16px" />
                  </div>
                ))}
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="inventory-empty-state">
                <h3>Everything looks good</h3>
                <p>No low-stock items were found in this organization.</p>
              </div>
            ) : (
              <div className="inventory-table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Current Stock</th>
                      <th>Threshold</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <strong>{item.productDetails?.name || "—"}</strong>
                        </td>
                        <td>{item.variantDetails?.sku || "—"}</td>
                        <td>{item.quantity}</td>
                        <td>{item.lowStockThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {isAdjustmentOpen && adjustmentItem && (
        <div
          className="inventory-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAdjustmentModal();
            }
          }}
        >
          <section
            className="inventory-quick-adjust-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-adjust-title"
          >
            <div className="inventory-modal-header">
              <div>
                <p className="inventory-eyebrow">STOCK CONTROL</p>
                <h2 id="quick-adjust-title">Adjust Stock</h2>
                <p>
                  {adjustmentItem.product.name} · SKU:{" "}
                  {adjustmentItem.variant.sku}
                </p>
              </div>

              <button
                type="button"
                className="inventory-modal-close"
                onClick={closeAdjustmentModal}
                disabled={isAdjusting}
                aria-label="Close adjustment modal"
              >
                ×
              </button>
            </div>

            <div className="inventory-modal-current-stock">
              <span>Current Quantity</span>
              <strong>{adjustmentItem.quantity}</strong>
              <span>Low Stock At: {adjustmentItem.lowStockThreshold}</span>
            </div>

            <form
              className="inventory-quick-adjust-form"
              onSubmit={handleQuickAdjustment}
            >
              {adjustmentError && (
                <div className="inventory-alert" role="alert">
                  {adjustmentError}
                </div>
              )}

              {adjustmentSuccess && (
                <div className="inventory-success" role="status">
                  {adjustmentSuccess}
                </div>
              )}

              <label>
                Adjustment Type
                <select
                  name="type"
                  value={adjustmentForm.type}
                  onChange={handleAdjustmentFormChange}
                  disabled={isAdjusting}
                >
                  <option value="stock_in">Stock In</option>
                  <option value="stock_out">Stock Out</option>
                  <option value="adjustment">Set Actual Quantity</option>
                </select>
              </label>

              <label>
                {adjustmentForm.type === "adjustment"
                  ? "Actual Stock Quantity"
                  : "Quantity"}
                <input
                  type="number"
                  name="quantity"
                  min="0"
                  max="1000000000"
                  step="0.001"
                  value={adjustmentForm.quantity}
                  onChange={handleAdjustmentFormChange}
                  placeholder="Enter quantity"
                  required
                  disabled={isAdjusting}
                />
              </label>

              <label>
                Reason
                <textarea
                  name="reason"
                  value={adjustmentForm.reason}
                  onChange={handleAdjustmentFormChange}
                  placeholder="Enter the reason for this adjustment"
                  minLength={3}
                  maxLength={500}
                  required
                  disabled={isAdjusting}
                />
              </label>

              <div className="inventory-quick-adjust-actions">
                <button
                  type="button"
                  className="inventory-secondary-button"
                  onClick={closeAdjustmentModal}
                  disabled={isAdjusting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inventory-primary-button"
                  disabled={isAdjusting}
                >
                  {isAdjusting ? "Adjusting..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
