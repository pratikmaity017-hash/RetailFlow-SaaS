import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createCustomer } from "../customerService";
import { getUserOrganizations } from "../../organization/organizationService";

import Skeleton from "../../../shared/components/Skeleton";
import "./create-customer.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  notes: "",
};

export default function CreateCustomerPage() {
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

        const selectedOrganization = organizations.find(
          (item) => item.organization.id === savedOrganizationId,
        );

        if (!selectedOrganization) {
          throw new Error("Please select an active organization first.");
        }

        if (!["owner", "manager"].includes(selectedOrganization.role)) {
          throw new Error("You do not have permission to add customers.");
        }

        if (isMounted) {
          setOrganizationId(selectedOrganization.organization.id);
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
      setError("Customer name must contain at least 2 characters.");
      return;
    }

    try {
      setError("");
      setIsSaving(true);

      const customerData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        address: {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        },
        notes: formData.notes.trim(),
      };

      const response = await createCustomer(organizationId, customerData);

      const createdCustomer = response?.data?.customer;

      if (!createdCustomer?._id) {
        throw new Error(
          "Customer was created, but its details could not be retrieved.",
        );
      }

      navigate(`/customers/${createdCustomer._id}`, {
        state: {
          successMessage: "Customer created successfully.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to create customer.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="create-customer-page">
        <Skeleton width="180px" height="14px" />
        <Skeleton width="260px" height="32px" />
        <Skeleton width="100%" height="280px" />
      </main>
    );
  }

  if (error && !organizationId) {
    return (
      <main className="create-customer-page">
        <button
          type="button"
          className="create-customer-back-button"
          onClick={() => navigate("/customers")}
        >
          ← Back to Customers
        </button>

        <div className="create-customer-alert" role="alert">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="create-customer-page">
      <header className="create-customer-header">
        <button
          type="button"
          className="create-customer-back-button"
          onClick={() => navigate("/customers")}
        >
          ← Back to Customers
        </button>

        <p className="create-customer-eyebrow">CUSTOMER MANAGEMENT</p>

        <h1>Add Customer</h1>

        <p className="create-customer-subtitle">
          Add a new customer to your organization.
        </p>
      </header>

      {error && (
        <div className="create-customer-alert" role="alert">
          {error}
        </div>
      )}

      <form className="create-customer-form" onSubmit={handleSubmit}>
        <section className="create-customer-section">
          <div className="create-customer-section-header">
            <h2>Personal Information</h2>
            <p>Enter the customer's basic contact information.</p>
          </div>

          <div className="create-customer-grid">
            <div className="create-customer-field">
              <label htmlFor="customer-name">
                Customer Name <span>*</span>
              </label>

              <input
                id="customer-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                minLength={2}
                maxLength={150}
                required
                placeholder="Enter customer name"
              />
            </div>

            <div className="create-customer-field">
              <label htmlFor="customer-phone">Phone Number</label>

              <input
                id="customer-phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                maxLength={20}
                placeholder="Enter phone number"
              />
            </div>

            <div className="create-customer-field">
              <label htmlFor="customer-email">Email Address</label>

              <input
                id="customer-email"
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

        <section className="create-customer-section">
          <div className="create-customer-section-header">
            <h2>Address Information</h2>
            <p>Enter the customer's address (optional).</p>
          </div>

          <div className="create-customer-grid">
            <div className="create-customer-field create-customer-full-width">
              <label htmlFor="customer-street">Street Address</label>

              <input
                id="customer-street"
                name="street"
                type="text"
                value={formData.street}
                onChange={handleChange}
                maxLength={150}
                placeholder="Enter street address"
              />
            </div>

            <div className="create-customer-field">
              <label htmlFor="customer-city">City</label>

              <input
                id="customer-city"
                name="city"
                type="text"
                value={formData.city}
                onChange={handleChange}
                maxLength={100}
                placeholder="Enter city"
              />
            </div>

            <div className="create-customer-field">
              <label htmlFor="customer-state">State</label>

              <input
                id="customer-state"
                name="state"
                type="text"
                value={formData.state}
                onChange={handleChange}
                maxLength={100}
                placeholder="Enter state"
              />
            </div>

            <div className="create-customer-field">
              <label htmlFor="customer-postal">Postal Code</label>

              <input
                id="customer-postal"
                name="postalCode"
                type="text"
                value={formData.postalCode}
                onChange={handleChange}
                maxLength={20}
                placeholder="Enter postal code"
              />
            </div>

            <div className="create-customer-field">
              <label htmlFor="customer-country">Country</label>

              <input
                id="customer-country"
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

        <section className="create-customer-section">
          <div className="create-customer-section-header">
            <h2>Additional Notes</h2>
            <p>Add any additional information about this customer.</p>
          </div>

          <div className="create-customer-field">
            <label htmlFor="customer-notes">Notes</label>

            <textarea
              id="customer-notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              maxLength={1000}
              rows={5}
              placeholder="Enter additional notes..."
            />
          </div>
        </section>

        <div className="create-customer-form-actions">
          <button
            type="button"
            className="create-customer-cancel-button"
            onClick={() => navigate("/customers")}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="create-customer-save-button"
            disabled={isSaving}
          >
            {isSaving ? "Creating Customer..." : "Create Customer"}
          </button>
        </div>
      </form>
    </main>
  );
}
