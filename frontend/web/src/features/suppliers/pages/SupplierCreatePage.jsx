import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createSupplier } from "../supplierService";
import { getUserOrganizations } from "../../organization/organizationService";

import Skeleton from "../../../shared/components/Skeleton";
import "./create-supplier.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

const INITIAL_FORM = {
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

export default function SupplierCreatePage() {
  const navigate = useNavigate();

  const [organizationId, setOrganizationId] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOrganization() {
      try {
        const response = await getUserOrganizations();
        const organizations = response?.data?.organizations || [];

        const savedOrganizationId = localStorage.getItem(
          ORGANIZATION_STORAGE_KEY,
        );

        const savedOrganizationExists = organizations.some(
          (item) => item.organization.id === savedOrganizationId,
        );

        const selectedOrganization = savedOrganizationExists
          ? organizations.find(
              (item) => item.organization.id === savedOrganizationId,
            )
          : organizations[0];

        if (!selectedOrganization) {
          throw new Error("Please select an active organization first.");
        }

        if (!["owner", "manager"].includes(selectedOrganization.role)) {
          throw new Error("You do not have permission to add suppliers.");
        }

        if (isMounted) {
          const selectedId = selectedOrganization.organization.id;

          setOrganizationId(selectedId);
          localStorage.setItem(ORGANIZATION_STORAGE_KEY, selectedId);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load organization.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOrganization();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (formData.name.trim().length < 2) {
      setError("Supplier name must contain at least 2 characters.");
      return;
    }

    try {
      setError("");
      setIsSaving(true);

      const addressFields = {
        street: formData.street.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim(),
      };

      const address = Object.fromEntries(
        Object.entries(addressFields).filter(([, value]) => value),
      );

      const supplierData = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim(),
        email: formData.email.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        pan: formData.pan.trim().toUpperCase(),
        notes: formData.notes.trim(),
      };

      if (Object.keys(address).length > 0) {
        supplierData.address = address;
      }

      // Remove optional empty fields before sending to the API.
      Object.keys(supplierData).forEach((key) => {
        if (supplierData[key] === "") {
          delete supplierData[key];
        }
      });

      const response = await createSupplier(organizationId, supplierData);

      const createdSupplier = response?.data?.supplier;

      if (!createdSupplier?._id) {
        throw new Error(
          "Supplier was created, but its details could not be retrieved.",
        );
      }

      navigate("/suppliers", {
        state: {
          successMessage: "Supplier created successfully.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to create supplier.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="create-supplier-page">
        <Skeleton width="180px" height="14px" />
        <Skeleton width="260px" height="32px" />
        <Skeleton width="100%" height="280px" />
      </main>
    );
  }

  if (error && !organizationId) {
    return (
      <main className="create-supplier-page">
        <button
          type="button"
          className="create-supplier-back-button"
          onClick={() => navigate("/suppliers")}
        >
          ← Back to Suppliers
        </button>

        <div className="create-supplier-alert" role="alert">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="create-supplier-page">
      <header className="create-supplier-header">
        <button
          type="button"
          className="create-supplier-back-button"
          onClick={() => navigate("/suppliers")}
        >
          ← Back to Suppliers
        </button>

        <p className="create-supplier-eyebrow">SUPPLIER MANAGEMENT</p>

        <h1>Add Supplier</h1>

        <p className="create-supplier-subtitle">
          Add a new supplier to your organization.
        </p>
      </header>

      {error && (
        <div className="create-supplier-alert" role="alert">
          {error}
        </div>
      )}

      <form className="create-supplier-form" onSubmit={handleSubmit}>
        <section className="create-supplier-section">
          <div className="create-supplier-section-header">
            <h2>Business Information</h2>
            <p>Enter the supplier's business details.</p>
          </div>

          <div className="create-supplier-grid">
            <div className="create-supplier-field">
              <label htmlFor="supplier-name">
                Supplier Name <span>*</span>
              </label>

              <input
                id="supplier-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                minLength={2}
                maxLength={150}
                required
                placeholder="Enter supplier or business name"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-contact-person">Contact Person</label>

              <input
                id="supplier-contact-person"
                name="contactPerson"
                type="text"
                value={formData.contactPerson}
                onChange={handleChange}
                maxLength={100}
                placeholder="Enter contact person's name"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-phone">Phone Number</label>

              <input
                id="supplier-phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                maxLength={20}
                placeholder="Enter phone number"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-alternate-phone">Alternate Phone</label>

              <input
                id="supplier-alternate-phone"
                name="alternatePhone"
                type="tel"
                value={formData.alternatePhone}
                onChange={handleChange}
                maxLength={20}
                placeholder="Enter alternate phone number"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-email">Email Address</label>

              <input
                id="supplier-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                maxLength={254}
                placeholder="Enter email address"
              />
            </div>
          </div>
        </section>

        <section className="create-supplier-section">
          <div className="create-supplier-section-header">
            <h2>Address Information</h2>
            <p>Enter the supplier's business address (optional).</p>
          </div>

          <div className="create-supplier-grid">
            <div className="create-supplier-field create-supplier-full-width">
              <label htmlFor="supplier-street">Street Address</label>

              <input
                id="supplier-street"
                name="street"
                type="text"
                value={formData.street}
                onChange={handleChange}
                maxLength={150}
                placeholder="Enter street address"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-city">City</label>

              <input
                id="supplier-city"
                name="city"
                type="text"
                value={formData.city}
                onChange={handleChange}
                maxLength={100}
                placeholder="Enter city"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-state">State</label>

              <input
                id="supplier-state"
                name="state"
                type="text"
                value={formData.state}
                onChange={handleChange}
                maxLength={100}
                placeholder="Enter state"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-postal">Postal Code</label>

              <input
                id="supplier-postal"
                name="postalCode"
                type="text"
                value={formData.postalCode}
                onChange={handleChange}
                maxLength={20}
                placeholder="Enter postal code"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-country">Country</label>

              <input
                id="supplier-country"
                name="country"
                type="text"
                value={formData.country}
                onChange={handleChange}
                maxLength={100}
                placeholder="Enter country"
              />
            </div>
          </div>
        </section>

        <section className="create-supplier-section">
          <div className="create-supplier-section-header">
            <h2>Tax Information</h2>
            <p>Enter GSTIN and PAN details if available.</p>
          </div>

          <div className="create-supplier-grid">
            <div className="create-supplier-field">
              <label htmlFor="supplier-gstin">GSTIN</label>

              <input
                id="supplier-gstin"
                name="gstin"
                type="text"
                value={formData.gstin}
                onChange={handleChange}
                maxLength={15}
                placeholder="Enter GSTIN"
              />
            </div>

            <div className="create-supplier-field">
              <label htmlFor="supplier-pan">PAN</label>

              <input
                id="supplier-pan"
                name="pan"
                type="text"
                value={formData.pan}
                onChange={handleChange}
                maxLength={10}
                placeholder="Enter PAN"
              />
            </div>
          </div>
        </section>

        <section className="create-supplier-section">
          <div className="create-supplier-section-header">
            <h2>Additional Notes</h2>
            <p>Add any additional information about this supplier.</p>
          </div>

          <div className="create-supplier-field">
            <label htmlFor="supplier-notes">Notes</label>

            <textarea
              id="supplier-notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              maxLength={1000}
              rows={5}
              placeholder="Enter additional notes..."
            />
          </div>
        </section>

        <div className="create-supplier-form-actions">
          <button
            type="button"
            className="create-supplier-cancel-button"
            onClick={() => navigate("/suppliers")}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="create-supplier-save-button"
            disabled={isSaving}
          >
            {isSaving ? "Creating Supplier..." : "Create Supplier"}
          </button>
        </div>
      </form>
    </main>
  );
}
