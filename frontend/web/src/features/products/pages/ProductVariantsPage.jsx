import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getProducts,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deactivateProductVariant,
  reactivateProductVariant,
} from "../productService";

import { getUserOrganizations } from "../../organization/organizationService";

import "./product-variants.css";

export default function ProductVariantsPage() {
  const navigate = useNavigate();
  const { productId } = useParams();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isVariantsLoading, setIsVariantsLoading] = useState(false);
  const [error, setError] = useState("");

  const initialVariantForm = {
    sku: "",
    barcode: "",
    costPrice: "",
    sellingPrice: "",
  };

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [editVariantForm, setEditVariantForm] = useState({
    sku: "",
    barcode: "",
    costPrice: "",
    sellingPrice: "",
  });

  const [editAttributeRows, setEditAttributeRows] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [variantForm, setVariantForm] = useState(initialVariantForm);

  const [attributeRows, setAttributeRows] = useState([{ key: "", value: "" }]);
  const [changingStatusVariantId, setChangingStatusVariantId] = useState("");
  const [statusActionError, setStatusActionError] = useState("");

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

  // Load the selected product and its variants.
  useEffect(() => {
    if (!selectedOrganizationId || !productId) return;

    let isMounted = true;

    async function loadProductAndVariants() {
      try {
        setIsVariantsLoading(true);
        setError("");
        setProduct(null);
        setVariants([]);

        const productsResponse = await getProducts(selectedOrganizationId);

        if (!isMounted) return;

        const availableProducts = productsResponse?.data?.products || [];

        const selectedProduct = availableProducts.find(
          (item) => item._id === productId,
        );

        if (!selectedProduct) {
          setError(
            "Product not found in the selected organization, or you do not have access to it.",
          );
          return;
        }

        setProduct(selectedProduct);

        const variantsResponse = await getProductVariants(
          selectedOrganizationId,
          productId,
        );

        if (isMounted) {
          setVariants(variantsResponse?.data?.variants || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load product variants.");
        }
      } finally {
        if (isMounted) {
          setIsVariantsLoading(false);
        }
      }
    }

    loadProductAndVariants();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId, productId]);

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const canManageVariants = ["owner", "manager"].includes(
    selectedOrganization?.role,
  );

  const canChangeVariantStatus = selectedOrganization?.role === "owner";

  // Filter variants by SKU, barcode, attributes and status.
  const filteredVariants = useMemo(() => {
    return variants.filter((variant) => {
      const searchText = search.trim().toLowerCase();

      const searchableAttributes = Object.entries(variant.attributes || {})
        .map(([key, value]) => `${key} ${String(value)}`)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        variant.sku?.toLowerCase().includes(searchText) ||
        variant.barcode?.toLowerCase().includes(searchText) ||
        searchableAttributes.includes(searchText);

      const matchesStatus =
        statusFilter === "all" || variant.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [variants, search, statusFilter]);

  const activeCount = variants.filter(
    (variant) => variant.status === "active",
  ).length;

  const inactiveCount = variants.filter(
    (variant) => variant.status === "inactive",
  ).length;

  async function handleCreateVariant(event) {
    event.preventDefault();

    if (!selectedOrganizationId || !product) return;

    setFormError("");
    setSuccessMessage("");

    const attributes = {};

    for (const row of attributeRows) {
      const key = row.key.trim();
      const value = row.value.trim();

      if (!key && !value) continue;

      if (!key || !value) {
        setFormError("Enter both the attribute name and value.");
        return;
      }

      if (Object.hasOwn(attributes, key)) {
        setFormError(`Duplicate attribute: ${key}`);
        return;
      }

      attributes[key] = value;
    }

    const costPrice = Number(variantForm.costPrice);
    const sellingPrice = Number(variantForm.sellingPrice);

    if (
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      costPrice < 0 ||
      sellingPrice < 0
    ) {
      setFormError("Enter valid non-negative prices.");
      return;
    }

    const variantData = {
      sku: variantForm.sku.trim(),
      costPrice,
      sellingPrice,
      ...(variantForm.barcode.trim()
        ? { barcode: variantForm.barcode.trim() }
        : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    };

    try {
      setIsCreating(true);

      const response = await createProductVariant(
        selectedOrganizationId,
        productId,
        variantData,
      );

      const createdVariant = response?.data?.variant;

      if (!createdVariant) {
        throw new Error("Variant was created, but the response was invalid.");
      }

      setVariants((previous) => [createdVariant, ...previous]);
      setVariantForm(initialVariantForm);
      setAttributeRows([{ key: "", value: "" }]);
      setIsCreateFormOpen(false);
      setSuccessMessage("Product variant created successfully.");
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create product variant.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleStartEditing(variant) {
    setFormError("");
    setSuccessMessage("");
    setEditingVariantId(variant._id);

    setEditVariantForm({
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      costPrice: String(variant.costPrice ?? ""),
      sellingPrice: String(variant.sellingPrice ?? ""),
    });

    setEditAttributeRows(
      Object.entries(variant.attributes || {}).map(([key, value]) => ({
        key,
        value: String(value),
      })),
    );
  }

  function handleCancelEditing() {
    setEditingVariantId("");
    setEditAttributeRows([]);
    setFormError("");
  }

  async function handleUpdateVariant(event) {
    event.preventDefault();

    if (!selectedOrganizationId || !product || !editingVariantId) {
      return;
    }

    setFormError("");
    setSuccessMessage("");

    const attributes = {};

    for (const row of editAttributeRows) {
      const key = row.key.trim();
      const value = row.value.trim();

      if (!key && !value) continue;

      if (!key || !value) {
        setFormError("Enter both the attribute name and value.");
        return;
      }

      if (Object.hasOwn(attributes, key)) {
        setFormError(`Duplicate attribute: ${key}`);
        return;
      }

      attributes[key] = value;
    }

    const costPrice = Number(editVariantForm.costPrice);
    const sellingPrice = Number(editVariantForm.sellingPrice);

    if (
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      costPrice < 0 ||
      sellingPrice < 0
    ) {
      setFormError("Enter valid non-negative prices.");
      return;
    }

    const variantData = {
      sku: editVariantForm.sku.trim(),
      costPrice,
      sellingPrice,
      barcode: editVariantForm.barcode.trim() || null,
      attributes,
    };

    try {
      setIsUpdating(true);

      const response = await updateProductVariant(
        selectedOrganizationId,
        productId,
        editingVariantId,
        variantData,
      );

      const updatedVariant = response?.data?.variant;

      if (!updatedVariant) {
        throw new Error("Variant was updated, but the response was invalid.");
      }

      setVariants((previous) =>
        previous.map((variant) =>
          variant._id === editingVariantId ? updatedVariant : variant,
        ),
      );

      setEditingVariantId("");
      setEditAttributeRows([]);
      setSuccessMessage("Product variant updated successfully.");
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update product variant.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleChangeVariantStatus(variant) {
    if (!canChangeVariantStatus) return;

    const isCurrentlyActive = variant.status === "active";
    const nextStatus = isCurrentlyActive ? "inactive" : "active";

    const confirmed = window.confirm(
      `Are you sure you want to ${
        isCurrentlyActive ? "deactivate" : "reactivate"
      } variant "${variant.sku}"?`,
    );

    if (!confirmed) return;

    setStatusActionError("");
    setSuccessMessage("");

    try {
      setChangingStatusVariantId(variant._id);

      const response = isCurrentlyActive
        ? await deactivateProductVariant(
            selectedOrganizationId,
            productId,
            variant._id,
          )
        : await reactivateProductVariant(
            selectedOrganizationId,
            productId,
            variant._id,
          );

      const updatedVariant = response?.data?.variant;

      if (!updatedVariant) {
        throw new Error(
          "Variant status was changed, but the response was invalid.",
        );
      }

      setVariants((previous) =>
        previous.map((item) =>
          item._id === variant._id ? updatedVariant : item,
        ),
      );

      setSuccessMessage(
        `Variant ${isCurrentlyActive ? "deactivated" : "reactivated"} successfully.`,
      );
    } catch (err) {
      setStatusActionError(
        err.response?.data?.message ||
          err.message ||
          "Unable to change variant status.",
      );
    } finally {
      setChangingStatusVariantId("");
    }
  }

  if (isLoading) {
    return (
      <main className="variant-page">
        <p className="variant-loading">Loading organizations...</p>
      </main>
    );
  }

  return (
    <main className="variant-page">
      <header className="variant-page-header">
        <div>
          <p className="variant-eyebrow">INVENTORY MANAGEMENT</p>
          <h1>Product Variants</h1>
          <p className="variant-subtitle">
            Manage SKU-level details, pricing and availability.
          </p>
          {selectedOrganization && (
            <div className="variant-context-info">
              <p>
                Organization:{" "}
                <strong>{selectedOrganization.organization.name}</strong>
              </p>

              <p>
                Your Role:{" "}
                <strong className="variant-role-badge">
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
          className="variant-secondary-button"
          onClick={() => navigate("/products")}
        >
          Back to Products
        </button>
      </header>

      {organizations.length > 1 && (
        <section className="variant-organization">
          <label htmlFor="variant-organization">Select organization</label>

          <select
            id="variant-organization"
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
        <div className="variant-alert">
          No active organization is available for your account.
        </div>
      )}

      {error && (
        <div className="variant-alert" role="alert">
          {error}
        </div>
      )}

      {selectedOrganizationId && !error && (
        <>
          {product && (
            <section className="variant-product-summary">
              <div>
                <span>Selected product</span>
                <h2>{product.name}</h2>
                <p>
                  {product.brand || "No brand"}
                  {product.category ? ` · ${product.category}` : ""}
                </p>
              </div>

              {canManageVariants && (
                <button
                  type="button"
                  className="variant-primary-button"
                  disabled={product.status !== "active"}
                  title={
                    product.status !== "active"
                      ? "Inactive products cannot receive new variants."
                      : ""
                  }
                  onClick={() => {
                    setFormError("");
                    setSuccessMessage("");
                    setIsCreateFormOpen((previous) => !previous);
                  }}
                >
                  {isCreateFormOpen ? "Cancel" : "+ Add Variant"}
                </button>
              )}
            </section>
          )}

          {product && (
            <>
              {successMessage && (
                <div className="variant-success" role="status">
                  {successMessage}
                </div>
              )}

              {statusActionError && (
                <div className="variant-alert" role="alert">
                  {statusActionError}
                </div>
              )}

              {isCreateFormOpen && (
                <form
                  className="variant-form-card"
                  onSubmit={handleCreateVariant}
                >
                  <div className="variant-form-header">
                    <div>
                      <h2>Add Product Variant</h2>
                      <p>Enter SKU-level pricing and variant attributes.</p>
                    </div>
                  </div>

                  {formError && (
                    <div className="variant-alert" role="alert">
                      {formError}
                    </div>
                  )}

                  <div className="variant-form-grid">
                    <label>
                      SKU *
                      <input
                        type="text"
                        value={variantForm.sku}
                        onChange={(event) =>
                          setVariantForm((previous) => ({
                            ...previous,
                            sku: event.target.value,
                          }))
                        }
                        maxLength={100}
                        required
                        placeholder="e.g. WM-BLK-002"
                      />
                    </label>

                    <label>
                      Barcode
                      <input
                        type="text"
                        value={variantForm.barcode}
                        onChange={(event) =>
                          setVariantForm((previous) => ({
                            ...previous,
                            barcode: event.target.value,
                          }))
                        }
                        maxLength={100}
                        placeholder="Optional barcode"
                      />
                    </label>

                    <label>
                      Cost Price (₹) *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variantForm.costPrice}
                        onChange={(event) =>
                          setVariantForm((previous) => ({
                            ...previous,
                            costPrice: event.target.value,
                          }))
                        }
                        required
                        placeholder="450"
                      />
                    </label>

                    <label>
                      Selling Price (₹) *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variantForm.sellingPrice}
                        onChange={(event) =>
                          setVariantForm((previous) => ({
                            ...previous,
                            sellingPrice: event.target.value,
                          }))
                        }
                        required
                        placeholder="699"
                      />
                    </label>
                  </div>

                  <div className="variant-attributes-section">
                    <div className="variant-attributes-header">
                      <div>
                        <h3>Attributes</h3>
                        <p>Examples: Color, Size, Type, Connectivity.</p>
                      </div>

                      <button
                        type="button"
                        className="variant-add-attribute-button"
                        onClick={() =>
                          setAttributeRows((previous) => [
                            ...previous,
                            { key: "", value: "" },
                          ])
                        }
                      >
                        + Add Attribute
                      </button>
                    </div>

                    {attributeRows.map((row, index) => (
                      <div className="variant-attribute-row" key={index}>
                        <input
                          type="text"
                          placeholder="Attribute name"
                          value={row.key}
                          onChange={(event) =>
                            setAttributeRows((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, key: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />

                        <input
                          type="text"
                          placeholder="Attribute value"
                          value={row.value}
                          onChange={(event) =>
                            setAttributeRows((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, value: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />

                        {attributeRows.length > 1 && (
                          <button
                            type="button"
                            className="variant-remove-attribute-button"
                            onClick={() =>
                              setAttributeRows((previous) =>
                                previous.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                            aria-label={`Remove attribute ${index + 1}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="variant-form-actions">
                    <button
                      type="button"
                      className="variant-secondary-button"
                      disabled={isCreating}
                      onClick={() => {
                        setIsCreateFormOpen(false);
                        setFormError("");
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="variant-primary-button"
                      disabled={isCreating}
                    >
                      {isCreating ? "Creating..." : "Create Variant"}
                    </button>
                  </div>
                </form>
              )}

              {editingVariantId && (
                <form
                  className="variant-form-card"
                  onSubmit={handleUpdateVariant}
                >
                  <div className="variant-form-header">
                    <div>
                      <h2>Edit Product Variant</h2>
                      <p>Update SKU, pricing and variant attributes.</p>
                    </div>
                  </div>

                  {formError && (
                    <div className="variant-alert" role="alert">
                      {formError}
                    </div>
                  )}

                  <div className="variant-form-grid">
                    <label>
                      SKU *
                      <input
                        type="text"
                        value={editVariantForm.sku}
                        onChange={(event) =>
                          setEditVariantForm((previous) => ({
                            ...previous,
                            sku: event.target.value,
                          }))
                        }
                        maxLength={100}
                        required
                      />
                    </label>

                    <label>
                      Barcode
                      <input
                        type="text"
                        value={editVariantForm.barcode}
                        onChange={(event) =>
                          setEditVariantForm((previous) => ({
                            ...previous,
                            barcode: event.target.value,
                          }))
                        }
                        maxLength={100}
                      />
                    </label>

                    <label>
                      Cost Price (₹) *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editVariantForm.costPrice}
                        onChange={(event) =>
                          setEditVariantForm((previous) => ({
                            ...previous,
                            costPrice: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label>
                      Selling Price (₹) *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editVariantForm.sellingPrice}
                        onChange={(event) =>
                          setEditVariantForm((previous) => ({
                            ...previous,
                            sellingPrice: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="variant-attributes-section">
                    <div className="variant-attributes-header">
                      <div>
                        <h3>Attributes</h3>
                        <p>Update color, size, type, connectivity, etc.</p>
                      </div>

                      <button
                        type="button"
                        className="variant-add-attribute-button"
                        onClick={() =>
                          setEditAttributeRows((previous) => [
                            ...previous,
                            { key: "", value: "" },
                          ])
                        }
                      >
                        + Add Attribute
                      </button>
                    </div>

                    {editAttributeRows.map((row, index) => (
                      <div className="variant-attribute-row" key={index}>
                        <input
                          type="text"
                          placeholder="Attribute name"
                          value={row.key}
                          onChange={(event) =>
                            setEditAttributeRows((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, key: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />

                        <input
                          type="text"
                          placeholder="Attribute value"
                          value={row.value}
                          onChange={(event) =>
                            setEditAttributeRows((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, value: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />

                        <button
                          type="button"
                          className="variant-remove-attribute-button"
                          onClick={() =>
                            setEditAttributeRows((previous) =>
                              previous.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="variant-form-actions">
                    <button
                      type="button"
                      className="variant-secondary-button"
                      disabled={isUpdating}
                      onClick={handleCancelEditing}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="variant-primary-button"
                      disabled={isUpdating}
                    >
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              )}
              <section className="variant-stat-grid">
                <article className="variant-stat-card">
                  <span>Total Variants</span>
                  <strong>{variants.length}</strong>
                </article>

                <article className="variant-stat-card">
                  <span>Active Variants</span>
                  <strong>{activeCount}</strong>
                </article>

                <article className="variant-stat-card">
                  <span>Inactive Variants</span>
                  <strong>{inactiveCount}</strong>
                </article>
              </section>

              <section className="variant-list-card">
                <div className="variant-list-toolbar">
                  <div>
                    <h2>All Variants</h2>
                    <p>Manage individual product SKUs and their pricing.</p>
                  </div>

                  <div className="variant-filters">
                    <input
                      type="search"
                      placeholder="Search SKU, barcode..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      aria-label="Search variants"
                    />

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      aria-label="Filter variants by status"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {isVariantsLoading ? (
                  <p className="variant-loading">Loading product variants...</p>
                ) : filteredVariants.length === 0 ? (
                  <div className="variant-empty-state">
                    <h3>
                      {variants.length === 0
                        ? "No variants yet"
                        : "No matching variants"}
                    </h3>

                    <p>
                      {variants.length === 0
                        ? "Variants added to this product will appear here."
                        : "Try changing your search or status filter."}
                    </p>
                  </div>
                ) : (
                  <div className="variant-table-wrapper">
                    <table className="variant-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Barcode</th>
                          <th>Attributes</th>
                          <th>Cost Price</th>
                          <th>Selling Price</th>
                          <th>Status</th>
                          {canManageVariants && <th>Actions</th>}
                        </tr>
                      </thead>

                      <tbody>
                        {filteredVariants.map((variant) => (
                          <tr key={variant._id}>
                            <td>
                              <strong>{variant.sku}</strong>
                            </td>

                            <td>{variant.barcode || "—"}</td>

                            <td>
                              {Object.entries(variant.attributes || {})
                                .map(
                                  ([key, value]) => `${key}: ${String(value)}`,
                                )
                                .join(", ") || "—"}
                            </td>

                            <td>₹{Number(variant.costPrice).toFixed(2)}</td>

                            <td>₹{Number(variant.sellingPrice).toFixed(2)}</td>

                            <td>
                              <span
                                className={`variant-status variant-status-${variant.status}`}
                              >
                                {variant.status}
                              </span>
                            </td>

                            {canManageVariants && (
                              <td>
                                <div className="variant-row-actions">
                                  <button
                                    type="button"
                                    className="variant-edit-button"
                                    disabled={
                                      isUpdating ||
                                      changingStatusVariantId === variant._id
                                    }
                                    onClick={() => handleStartEditing(variant)}
                                  >
                                    Edit
                                  </button>

                                  {canChangeVariantStatus && (
                                    <button
                                      type="button"
                                      className={
                                        variant.status === "active"
                                          ? "variant-deactivate-button"
                                          : "variant-reactivate-button"
                                      }
                                      disabled={
                                        changingStatusVariantId ===
                                          variant._id || isUpdating
                                      }
                                      onClick={() =>
                                        handleChangeVariantStatus(variant)
                                      }
                                    >
                                      {changingStatusVariantId === variant._id
                                        ? "Updating..."
                                        : variant.status === "active"
                                          ? "Deactivate"
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
        </>
      )}

      {!selectedOrganizationId && organizations.length > 0 && (
        <div className="variant-empty-state">
          <h3>Select an organization</h3>
          <p>Choose an organization to load its product and variants.</p>
        </div>
      )}
    </main>
  );
}
