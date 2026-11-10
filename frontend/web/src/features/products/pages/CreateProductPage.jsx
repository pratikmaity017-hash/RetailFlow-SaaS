import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createProduct } from "../productService";
import { getUserOrganizations } from "../../organization/organizationService";

import "./create-product.css";

export default function CreateProductPage() {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    brand: "",
    category: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
          setError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load organizations.",
          );
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

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const canCreateProduct = ["owner", "manager"].includes(
    selectedOrganization?.role,
  );

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedOrganizationId) {
      setError("Please select an organization.");
      return;
    }

    if (!canCreateProduct) {
      setError("You do not have permission to create products.");
      return;
    }

    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      brand: formData.brand.trim(),
      category: formData.category.trim(),
    };

    if (productData.name.length < 2) {
      setError("Product name must be at least 2 characters.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await createProduct(selectedOrganizationId, productData);

      setSuccess(response?.message || "Product created successfully.");

      setFormData({
        name: "",
        description: "",
        brand: "",
        category: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create product.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="create-product-page">
        <p>Loading organizations...</p>
      </main>
    );
  }

  return (
    <main className="create-product-page">
      <div className="create-product-header">
        <div>
          <p className="create-product-eyebrow">INVENTORY MANAGEMENT</p>

          <h1>Add Product</h1>

          <p>Add a new product to your organization's catalog.</p>
        </div>

        <button
          type="button"
          className="create-product-secondary-button"
          onClick={() => navigate("/products")}
        >
          Back to Products
        </button>
      </div>

      {organizations.length === 0 ? (
        <div className="create-product-alert create-product-alert-error">
          No active organization is available for your account.
        </div>
      ) : (
        <section className="create-product-card">
          <form onSubmit={handleSubmit}>
            {organizations.length > 1 && (
              <div className="create-product-field">
                <label htmlFor="organizationId">Organization</label>

                <select
                  id="organizationId"
                  value={selectedOrganizationId}
                  onChange={(event) => {
                    setSelectedOrganizationId(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  required
                >
                  <option value="">Select organization</option>

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

            {selectedOrganizationId && !canCreateProduct && (
              <div className="create-product-alert create-product-alert-error">
                Your organization role does not allow product creation. Only
                Owners and Managers can create products.
              </div>
            )}

            {error && (
              <div
                className="create-product-alert create-product-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="create-product-alert create-product-alert-success"
                role="status"
              >
                {success}

                <button type="button" onClick={() => navigate("/products")}>
                  View Products
                </button>
              </div>
            )}

            <div className="create-product-field">
              <label htmlFor="name">
                Product Name <span>*</span>
              </label>

              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Samsung Galaxy S25"
                minLength={2}
                maxLength={150}
                required
              />

              <small>2–150 characters</small>
            </div>

            <div className="create-product-field">
              <label htmlFor="description">Description</label>

              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter product description..."
                maxLength={2000}
                rows={4}
              />

              <small>Maximum 2000 characters</small>
            </div>

            <div className="create-product-form-grid">
              <div className="create-product-field">
                <label htmlFor="brand">Brand</label>

                <input
                  id="brand"
                  name="brand"
                  type="text"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="e.g. Samsung"
                  maxLength={100}
                />
              </div>

              <div className="create-product-field">
                <label htmlFor="category">Category</label>

                <input
                  id="category"
                  name="category"
                  type="text"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="e.g. Smartphones"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="create-product-actions">
              <button
                type="button"
                className="create-product-secondary-button"
                onClick={() => navigate("/products")}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="create-product-primary-button"
                disabled={
                  isSubmitting || !selectedOrganizationId || !canCreateProduct
                }
              >
                {isSubmitting ? "Creating..." : "Create Product"}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
