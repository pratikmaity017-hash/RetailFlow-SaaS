import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getCustomerById, updateCustomer } from "../customerService";

import { getUserOrganizations } from "../../organization/organizationService";

import Skeleton from "../../../shared/components/Skeleton";
import "./edit-customer.css";

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

export default function EditCustomerPage() {
  const navigate = useNavigate();
  const { customerId } = useParams();

  const [organizationId, setOrganizationId] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      try {
        setIsLoading(true);
        setError("");

        const organizationResponse = await getUserOrganizations();

        const organizations = organizationResponse?.data?.organizations || [];

        const savedOrganizationId = localStorage.getItem(
          ORGANIZATION_STORAGE_KEY,
        );

        const selectedOrganization = organizations.find(
          (item) => item.organization.id === savedOrganizationId,
        );

        if (!selectedOrganization) {
          throw new Error("Please select an active organization.");
        }

        if (!["owner", "manager"].includes(selectedOrganization.role)) {
          throw new Error("You do not have permission to edit customers.");
        }

        const currentOrganizationId = selectedOrganization.organization.id;

        const response = await getCustomerById(
          currentOrganizationId,
          customerId,
        );

        const customer = response?.data?.customer;

        if (!customer) {
          throw new Error("Customer not found.");
        }

        if (isMounted) {
          const address = customer.address || {};

          setOrganizationId(currentOrganizationId);

          setFormData({
            name: customer.name || "",
            phone: customer.phone || "",
            email: customer.email || "",
            street: address.street || "",
            city: address.city || "",
            state: address.state || "",
            postalCode: address.postalCode || "",
            country: address.country || "",
            notes: customer.notes || "",
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load customer.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setError("");
      setSuccessMessage("");
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

      await updateCustomer(organizationId, customerId, customerData);

      setSuccessMessage("Customer updated successfully.");

      navigate(`/customers/${customerId}`, {
        state: {
          successMessage: "Customer updated successfully.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to update customer.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="edit-customer-page">
        <Skeleton width="180px" height="14px" />
        <Skeleton width="260px" height="32px" />
        <Skeleton width="100%" height="280px" />
      </main>
    );
  }

  if (error && !organizationId) {
    return (
      <main className="edit-customer-page">
        <button
          type="button"
          className="edit-customer-back-button"
          onClick={() => navigate("/customers")}
        >
          ← Back to Customers
        </button>

        <div className="edit-customer-alert" role="alert">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="edit-customer-page">
      <header className="edit-customer-header">
        <button
          type="button"
          className="edit-customer-back-button"
          onClick={() => navigate(`/customers/${customerId}`)}
        >
          ← Back to Customer Details
        </button>

        <p className="edit-customer-eyebrow">CUSTOMER MANAGEMENT</p>

        <h1>Edit Customer</h1>

        <p className="edit-customer-subtitle">
          Update customer contact and address information.
        </p>
      </header>

      {error && (
        <div className="edit-customer-alert" role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="edit-customer-success" role="status">
          {successMessage}
        </div>
      )}

      <form className="edit-customer-form" onSubmit={handleSubmit}>
        <section className="edit-customer-section">
          <div className="edit-customer-section-header">
            <h2>Personal Information</h2>
            <p>Update the customer's basic information.</p>
          </div>

          <div className="edit-customer-grid">
            <div className="edit-customer-field">
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

            <div className="edit-customer-field">
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

            <div className="edit-customer-field">
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

        <section className="edit-customer-section">
          <div className="edit-customer-section-header">
            <h2>Address Information</h2>
            <p>Update the customer's address.</p>
          </div>

          <div className="edit-customer-grid">
            <div className="edit-customer-field edit-customer-full-width">
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

            <div className="edit-customer-field">
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

            <div className="edit-customer-field">
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

            <div className="edit-customer-field">
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

            <div className="edit-customer-field">
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

        <section className="edit-customer-section">
          <div className="edit-customer-section-header">
            <h2>Additional Notes</h2>
            <p>Add any additional information about this customer.</p>
          </div>

          <div className="edit-customer-field">
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

        <div className="edit-customer-form-actions">
          <button
            type="button"
            className="edit-customer-cancel-button"
            onClick={() => navigate(`/customers/${customerId}`)}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="edit-customer-save-button"
            disabled={isSaving}
          >
            {isSaving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </main>
  );
}
