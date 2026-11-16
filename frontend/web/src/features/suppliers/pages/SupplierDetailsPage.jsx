import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSupplierById } from "../supplierService";
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

  if (loading) {
    return (
      <div className="supplier-details-page">
        <Skeleton />
      </div>
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
        <div>
          <button type="button" onClick={() => navigate("/suppliers")}>
            ← Back to Suppliers
          </button>

          <h1>{supplier.name}</h1>
          <p>Supplier information and contact details</p>
        </div>

        <span
          className={`supplier-details-status ${
            supplier.status === "active" ? "active" : "inactive"
          }`}
        >
          {supplier.status}
        </span>
      </header>

      <section className="supplier-details-card">
        <h2>Basic Information</h2>

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
