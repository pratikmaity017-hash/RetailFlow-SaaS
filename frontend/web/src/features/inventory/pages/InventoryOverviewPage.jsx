import { useEffect, useMemo, useState } from "react";

import { getUserOrganizations } from "../../organization/organizationService";
import { getProducts, getProductVariants } from "../../products/productService";
import { getVariantInventory, getLowStockInventory } from "../inventoryService";

import "./inventory.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

export default function InventoryOverviewPage() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [inventoryItems, setInventoryItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [error, setError] = useState("");

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

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

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
              <span>Tracked Variants</span>
              <strong>{totalVariants}</strong>
            </article>

            <article className="inventory-stat-card">
              <span>Total Stock Units</span>
              <strong>{totalStock.toLocaleString()}</strong>
            </article>

            <article className="inventory-stat-card">
              <span>Low Stock Variants</span>
              <strong>{lowStockCount}</strong>
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
              <p className="inventory-loading">Loading inventory...</p>
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
              <p className="inventory-loading">Loading low stock items...</p>
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
    </main>
  );
}
