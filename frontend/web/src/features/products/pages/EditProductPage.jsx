import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProducts, updateProduct } from "../productService";
import { getUserOrganizations } from "../../organization/organizationService";

import "./edit-product.css";

const initialFormData = {
  name: "",
  description: "",
  brand: "",
  category: "",
};

export default function EditProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [formData, setFormData] = useState(initialFormData);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      try {
        setIsLoading(true);
        setError("");

        const organizationResponse = await getUserOrganizations();
        const availableOrganizations =
          organizationResponse?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        // Load products only from organizations where the user
        // has owner or manager permissions.
        const editableOrganizations = availableOrganizations.filter((item) =>
          ["owner", "manager"].includes(item.role),
        );

        if (editableOrganizations.length === 0) {
          throw new Error("You don't have permission to edit products.");
        }

        const productResults = await Promise.all(
          editableOrganizations.map(async (item) => {
            try {
              const response = await getProducts(item.organization.id);

              return {
                organizationId: item.organization.id,
                products: response?.data?.products || [],
              };
            } catch {
              return null;
            }
          }),
        );

        if (!isMounted) return;

        const match = productResults.find((result) =>
          result?.products.some((product) => product._id === productId),
        );

        if (!match) {
          throw new Error(
            "Product not found or you don't have permission to edit it.",
          );
        }

        const product = match.products.find((item) => item._id === productId);

        setSelectedOrganizationId(match.organizationId);

        setFormData({
          name: product.name || "",
          description: product.description || "",
          brand: product.brand || "",
          category: product.category || "",
        });
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load product.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (formData.name.trim().length < 2) {
      setError("Product name must be at least 2 characters.");
      return;
    }

    if (!selectedOrganizationId) {
      setError("Unable to identify the product organization.");
      return;
    }

    try {
      setIsSaving(true);

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        brand: formData.brand.trim(),
        category: formData.category.trim(),
      };

      const response = await updateProduct(
        selectedOrganizationId,
        productId,
        productData,
      );

      setSuccess(response?.message || "Product updated successfully.");
    } catch (err) {
      setError(err.message || "Unable to update product.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="edit-product-page">
        <p className="edit-product-loading">Loading product...</p>
      </main>
    );
  }

  if (error && !selectedOrganizationId) {
    return (
      <main className="edit-product-page">
        <div className="edit-product-alert" role="alert">
          {error}
        </div>

        <button
          type="button"
          className="edit-product-secondary-button"
          onClick={() => navigate("/products")}
        >
          Back to Products
        </button>
      </main>
    );
  }

  return (
    <main className="edit-product-page">
      <header className="edit-product-header">
        <div>
          <p className="edit-product-eyebrow">INVENTORY MANAGEMENT</p>

          <h1>Edit Product</h1>

          <p className="edit-product-subtitle">
            Update your product information.
          </p>
        </div>

        <button
          type="button"
          className="edit-product-secondary-button"
          onClick={() => navigate("/products")}
        >
          Back to Products
        </button>
      </header>

      <section className="edit-product-card">
        {error && (
          <div className="edit-product-alert" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="edit-product-success" role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="edit-product-form-group">
            <label htmlFor="name">Product Name *</label>

            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              minLength={2}
              maxLength={150}
              required
              disabled={isSaving}
            />
          </div>

          <div className="edit-product-form-group">
            <label htmlFor="description">Description</label>

            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength={2000}
              rows={4}
              disabled={isSaving}
            />
          </div>

          <div className="edit-product-form-grid">
            <div className="edit-product-form-group">
              <label htmlFor="brand">Brand</label>

              <input
                id="brand"
                name="brand"
                type="text"
                value={formData.brand}
                onChange={handleChange}
                maxLength={100}
                disabled={isSaving}
              />
            </div>

            <div className="edit-product-form-group">
              <label htmlFor="category">Category</label>

              <input
                id="category"
                name="category"
                type="text"
                value={formData.category}
                onChange={handleChange}
                maxLength={100}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="edit-product-form-actions">
            <button
              type="button"
              className="edit-product-secondary-button"
              onClick={() => navigate("/products")}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="edit-product-primary-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
