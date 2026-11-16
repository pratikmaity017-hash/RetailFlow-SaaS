import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getCustomerById } from "../customerService";

import { getUserOrganizations } from "../../organization/organizationService";

import Skeleton from "../../../shared/components/Skeleton";
import "./customer-details.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

export default function CustomerDetailsPage() {
  const navigate = useNavigate();
  const { customerId } = useParams();

  const [customer, setCustomer] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCustomerDetails() {
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
          throw new Error("Please select an active organization first.");
        }

        const organizationId = selectedOrganization.organization.id;

        const customerResponse = await getCustomerById(
          organizationId,
          customerId,
        );

        if (isMounted) {
          setCustomer(customerResponse?.data?.customer || null);
          setUserRole(selectedOrganization.role || "");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load customer details.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCustomerDetails();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  const canEditCustomer = ["owner", "manager"].includes(userRole);

  if (isLoading) {
    return (
      <main className="customer-details-page">
        <Skeleton width="180px" height="14px" />
        <Skeleton width="260px" height="32px" />
        <Skeleton width="100%" height="180px" />
        <Skeleton width="100%" height="140px" />
      </main>
    );
  }

  if (error || !customer) {
    return (
      <main className="customer-details-page">
        <button
          type="button"
          className="customer-back-button"
          onClick={() => navigate("/customers")}
        >
          ← Back to Customers
        </button>

        <div className="customer-details-alert" role="alert">
          {error || "Customer not found."}
        </div>
      </main>
    );
  }

  const address = customer.address || {};

  return (
    <main className="customer-details-page">
      <header className="customer-details-header">
        <div>
          <button
            type="button"
            className="customer-back-button"
            onClick={() => navigate("/customers")}
          >
            ← Back to Customers
          </button>

          <p className="customer-details-eyebrow">CUSTOMER MANAGEMENT</p>

          <h1>{customer.name}</h1>

          <p className="customer-details-subtitle">
            View customer information and contact details.
          </p>
        </div>

        <div className="customer-details-header-actions">
          {canEditCustomer && (
            <button
              type="button"
              className="customer-edit-button"
              onClick={() => navigate(`/customers/${customerId}/edit`)}
            >
              Edit Customer
            </button>
          )}
        </div>
      </header>

      <section className="customer-details-card">
        <div className="customer-details-card-header">
          <div>
            <h2>Personal Information</h2>
            <p>Basic customer contact information.</p>
          </div>

          <span
            className={`customer-status customer-status-${customer.status}`}
          >
            {customer.status}
          </span>
        </div>

        <div className="customer-details-grid">
          <div className="customer-detail-item">
            <span>Full Name</span>
            <strong>{customer.name || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>Phone Number</span>
            <strong>{customer.phone || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>Email Address</span>
            <strong>{customer.email || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>Customer Status</span>
            <strong className="customer-detail-capitalize">
              {customer.status || "—"}
            </strong>
          </div>

          <div className="customer-detail-item">
            <span>Customer Since</span>
            <strong>
              {customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString()
                : "—"}
            </strong>
          </div>

          <div className="customer-detail-item">
            <span>Last Updated</span>
            <strong>
              {customer.updatedAt
                ? new Date(customer.updatedAt).toLocaleDateString()
                : "—"}
            </strong>
          </div>
        </div>
      </section>

      <section className="customer-details-card">
        <div className="customer-details-card-header">
          <div>
            <h2>Address Information</h2>
            <p>Customer's saved address.</p>
          </div>
        </div>

        <div className="customer-details-grid">
          <div className="customer-detail-item">
            <span>Street</span>
            <strong>{address.street || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>City</span>
            <strong>{address.city || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>State</span>
            <strong>{address.state || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>Postal Code</span>
            <strong>{address.postalCode || "—"}</strong>
          </div>

          <div className="customer-detail-item">
            <span>Country</span>
            <strong>{address.country || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="customer-details-card">
        <div className="customer-details-card-header">
          <div>
            <h2>Additional Notes</h2>
            <p>Additional information about this customer.</p>
          </div>
        </div>

        <div className="customer-notes-content">
          {customer.notes || "No additional notes available."}
        </div>
      </section>
    </main>
  );
}
