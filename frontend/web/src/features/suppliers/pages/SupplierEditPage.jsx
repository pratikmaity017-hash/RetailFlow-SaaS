import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getSupplierById, updateSupplier } from "../supplierService";

import { getUserOrganizations } from "../../organization/organizationService";
import Skeleton from "../../../shared/components/Skeleton";

import "./edit-supplier.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

const initialForm = {
  name: "",
  contactPerson: "",
  phone: "",
  alternatePhone: "",
  email: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  gstin: "",
  pan: "",
  notes: "",
};

export default function SupplierEditPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();

  const [organizationId, setOrganizationId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [formData, setFormData] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canEdit = ["owner", "manager"].includes(userRole);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const organizationResponse = await getUserOrganizations();

        const organizations = organizationResponse?.data?.organizations || [];

        const savedOrganizationId = localStorage.getItem(
          ORGANIZATION_STORAGE_KEY,
        );

        const selectedOrganization =
          organizations.find(
            (item) => item.organization.id === savedOrganizationId,
          ) || organizations[0];

        if (!selectedOrganization) {
          throw new Error("No organization is available.");
        }

        const selectedId = selectedOrganization.organization.id;

        if (!cancelled) {
          setOrganizationId(selectedId);
          setUserRole(selectedOrganization.role);
        }

        const response = await getSupplierById(selectedId, supplierId);

        const supplier = response?.data?.supplier;

        if (!supplier) {
          throw new Error("Supplier not found.");
        }

        if (cancelled) return;

        const address = supplier.address || {};

        setFormData({
          name: supplier.name || "",
          contactPerson: supplier.contactPerson || "",
          phone: supplier.phone || "",
          alternatePhone: supplier.alternatePhone || "",
          email: supplier.email || "",
          street: address.street || "",
          city: address.city || "",
          state: address.state || "",
          postalCode: address.postalCode || "",
          country: address.country || "",
          gstin: supplier.gstin || "",
          pan: supplier.pan || "",
          notes: supplier.notes || "",
        });

        localStorage.setItem(ORGANIZATION_STORAGE_KEY, selectedId);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load supplier.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setError("Supplier name must contain at least 2 characters.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const address = {
        street: formData.street.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim(),
      };

      const hasAddress = Object.values(address).some(Boolean);

      const supplierData = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim(),
        email: formData.email.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        pan: formData.pan.trim().toUpperCase(),
        notes: formData.notes.trim(),
        address: hasAddress ? address : {},
      };

      Object.keys(supplierData).forEach((key) => {
        if (supplierData[key] === "") {
          delete supplierData[key];
        }
      });

      await updateSupplier(organizationId, supplierId, supplierData);

      navigate(`/suppliers/${supplierId}`, {
        state: {
          successMessage: "Supplier updated successfully.",
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update supplier.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="edit-supplier-page">
        <Skeleton />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="edit-supplier-page">
        <h2>Access Denied</h2>
        <p>You do not have permission to edit suppliers.</p>

        <button
          type="button"
          onClick={() => navigate(`/suppliers/${supplierId}`)}
        >
          Back to Supplier
        </button>
      </div>
    );
  }

  const fields = [
    { name: "name", label: "Supplier Name", required: true },
    { name: "contactPerson", label: "Contact Person" },
    { name: "phone", label: "Phone" },
    { name: "alternatePhone", label: "Alternate Phone" },
    { name: "email", label: "Email", type: "email" },
    { name: "street", label: "Street" },
    { name: "city", label: "City" },
    { name: "state", label: "State" },
    { name: "postalCode", label: "Postal Code" },
    { name: "country", label: "Country" },
    { name: "gstin", label: "GSTIN", maxLength: 15 },
    { name: "pan", label: "PAN", maxLength: 10 },
  ];

  return (
    <div className="edit-supplier-page">
      <header className="edit-supplier-header">
        <div>
          <button
            type="button"
            className="edit-supplier-back"
            onClick={() => navigate(`/suppliers/${supplierId}`)}
          >
            ← Back to Supplier
          </button>

          <h1>Edit Supplier</h1>
          <p>Update supplier information</p>
        </div>
      </header>

      <form className="edit-supplier-form" onSubmit={handleSubmit}>
        <section className="edit-supplier-section">
          <h2>Supplier Information</h2>

          <div className="edit-supplier-grid">
            {fields.map((field) => (
              <div className="edit-supplier-field" key={field.name}>
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required ? " *" : ""}
                </label>

                <input
                  id={field.name}
                  name={field.name}
                  type={field.type || "text"}
                  value={formData[field.name]}
                  onChange={handleChange}
                  maxLength={field.maxLength}
                  required={field.required || false}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="edit-supplier-section">
          <h2>Additional Information</h2>

          <div className="edit-supplier-field">
            <label htmlFor="notes">Notes</label>

            <textarea
              id="notes"
              name="notes"
              rows={4}
              maxLength={1000}
              value={formData.notes}
              onChange={handleChange}
            />
          </div>
        </section>

        {error && <div className="edit-supplier-error">{error}</div>}

        <div className="edit-supplier-actions">
          <button
            type="button"
            className="edit-supplier-cancel"
            onClick={() => navigate(`/suppliers/${supplierId}`)}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="edit-supplier-submit"
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
