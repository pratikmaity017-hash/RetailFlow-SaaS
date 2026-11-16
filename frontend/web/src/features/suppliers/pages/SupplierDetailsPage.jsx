import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSupplierById, updateSupplierStatus } from "../supplierService";
import { getUserOrganizations } from "../../organization/organizationService";
import Skeleton from "../../../shared/components/Skeleton";
import "./supplier-details.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

function DetailItem({ label, value }) {
  return (
    <div className="supplier-detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default function SupplierDetailsPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusActionMessage, setStatusActionMessage] = useState("");
  const [statusActionError, setStatusActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSupplier() {
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

        const organizationId = selectedOrganization.organization.id;

        if (!cancelled) {
          setUserRole(selectedOrganization.role);
        }

        localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);

        const response = await getSupplierById(organizationId, supplierId);

        if (!response?.data?.supplier) {
          throw new Error("Supplier details could not be loaded.");
        }

        if (!cancelled) {
          setSupplier(response.data.supplier);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load supplier details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSupplier();

    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  async function handleSupplierStatusChange() {
    if (userRole !== "owner" || statusUpdating || !supplier) {
      return;
    }

    const nextStatus = supplier.status === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `Are you sure you want to ${nextStatus === "inactive" ? "deactivate" : "activate"} this supplier?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setStatusUpdating(true);
      setStatusActionMessage("");
      setStatusActionError("");

      const organizationId = localStorage.getItem(ORGANIZATION_STORAGE_KEY);

      const response = await updateSupplierStatus(
        organizationId,
        supplier._id,
        nextStatus,
      );

      if (!response?.data?.supplier) {
        throw new Error("Supplier status could not be updated.");
      }

      setSupplier(response.data.supplier);
      setStatusActionMessage(
        `Supplier ${nextStatus === "active" ? "activated" : "deactivated"} successfully.`,
      );
    } catch (err) {
      setStatusActionError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update supplier status.",
      );
    } finally {
      setStatusUpdating(false);
    }
  }

  if (loading) {
    return (
      <main className="supplier-details-page">
        <div className="supplier-details-skeleton-header">
          <Skeleton width="150px" height="14px" />
          <Skeleton width="260px" height="30px" />
          <Skeleton width="220px" height="14px" />
        </div>

        <section className="supplier-details-card">
          <div className="supplier-details-skeleton-card-header">
            <div>
              <Skeleton width="170px" height="18px" />
              <Skeleton width="230px" height="13px" />
            </div>
            <Skeleton width="75px" height="26px" />
          </div>

          <div className="supplier-details-skeleton-grid">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="supplier-details-skeleton-item">
                <Skeleton width="90px" height="12px" />
                <Skeleton width="150px" height="16px" />
              </div>
            ))}
          </div>
        </section>

        <section className="supplier-details-card">
          <Skeleton width="100px" height="18px" />

          <div className="supplier-details-skeleton-grid">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="supplier-details-skeleton-item">
                <Skeleton width="85px" height="12px" />
                <Skeleton width="145px" height="16px" />
              </div>
            ))}
          </div>
        </section>

        <section className="supplier-details-card">
          <Skeleton width="120px" height="18px" />
          <div className="supplier-details-skeleton-grid">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="supplier-details-skeleton-item">
                <Skeleton width="70px" height="12px" />
                <Skeleton width="130px" height="16px" />
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (error || !supplier) {
    return (
      <div className="supplier-details-page">
        <button type="button" onClick={() => navigate("/suppliers")}>
          ← Back to Suppliers
        </button>

        <div className="supplier-details-error">
          {error || "Supplier not found."}
        </div>
      </div>
    );
  }

  const address = supplier.address || {};

  return (
    <div className="supplier-details-page">
      <header className="supplier-details-header">
        <div className="supplier-details-heading">
          <button
            type="button"
            className="supplier-back-button"
            onClick={() => navigate("/suppliers")}
          >
            ← Back to Suppliers
          </button>

          <p className="supplier-details-eyebrow">SUPPLIER MANAGEMENT</p>

          <h1>{supplier.name}</h1>

          <p className="supplier-details-subtitle">
            View supplier information and contact details.
          </p>
        </div>

        <div className="supplier-details-header-actions">
          {["owner", "manager"].includes(userRole) && (
            <button
              type="button"
              className="supplier-edit-button"
              onClick={() => navigate(`/suppliers/${supplier._id}/edit`)}
            >
              Edit Supplier
            </button>
          )}
        </div>
      </header>

      <section className="supplier-details-card">
        <div className="supplier-details-card-header">
          <div>
            <h2>Basic Information</h2>
            <p>Supplier contact and business information.</p>
          </div>

          <span
            className={`supplier-status supplier-status-${supplier.status}`}
          >
            {supplier.status}
          </span>
          {userRole === "owner" && (
            <button
              type="button"
              className={`supplier-status-action-button ${
                supplier.status === "active" ? "deactivate" : "activate"
              }`}
              onClick={handleSupplierStatusChange}
              disabled={statusUpdating}
            >
              {statusUpdating
                ? "Updating..."
                : supplier.status === "active"
                  ? "Deactivate Supplier"
                  : "Activate Supplier"}
            </button>
          )}
        </div>

        {statusActionMessage && (
          <p className="supplier-status-success">{statusActionMessage}</p>
        )}

        {statusActionError && (
          <p className="supplier-status-error">{statusActionError}</p>
        )}

        <div className="supplier-details-grid">
          <DetailItem label="Supplier Name" value={supplier.name} />
          <DetailItem label="Contact Person" value={supplier.contactPerson} />
          <DetailItem label="Phone" value={supplier.phone} />
          <DetailItem label="Alternate Phone" value={supplier.alternatePhone} />
          <DetailItem label="Email" value={supplier.email} />
        </div>
      </section>

      <section className="supplier-details-card">
        <h2>Address</h2>

        <div className="supplier-details-grid">
          <DetailItem label="Street" value={address.street} />
          <DetailItem label="City" value={address.city} />
          <DetailItem label="State" value={address.state} />
          <DetailItem label="Postal Code" value={address.postalCode} />
          <DetailItem label="Country" value={address.country} />
        </div>
      </section>

      <section className="supplier-details-card">
        <h2>Tax Information</h2>

        <div className="supplier-details-grid">
          <DetailItem label="GSTIN" value={supplier.gstin} />
          <DetailItem label="PAN" value={supplier.pan} />
        </div>
      </section>

      <section className="supplier-details-card">
        <h2>Additional Information</h2>

        <DetailItem label="Notes" value={supplier.notes} />
      </section>
    </div>
  );
}
