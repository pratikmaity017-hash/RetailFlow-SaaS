import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSuppliers, updateSupplierStatus } from "../supplierService";
import { getUserOrganizations } from "../../organization/organizationService";

import Skeleton from "../../../shared/components/Skeleton";
import "./supplier-list.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";
const PAGE_SIZE = 20;

const EMPTY_PAGINATION = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export default function SupplierListPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [pagination, setPagination] = useState(EMPTY_PAGINATION);

  const [updatingSupplierId, setUpdatingSupplierId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        const response = await getUserOrganizations();
        const availableOrganizations = response?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        if (availableOrganizations.length === 0) {
          setSelectedOrganizationId("");
          localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
          return;
        }

        const savedOrganizationId = localStorage.getItem(
          ORGANIZATION_STORAGE_KEY,
        );

        const savedOrganizationExists = availableOrganizations.some(
          (item) => item.organization.id === savedOrganizationId,
        );

        const organizationId = savedOrganizationExists
          ? savedOrganizationId
          : availableOrganizations[0].organization.id;

        setSelectedOrganizationId(organizationId);
        localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
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

  useEffect(() => {
    if (!selectedOrganizationId) return;

    let isMounted = true;

    async function loadSuppliers() {
      try {
        setIsSuppliersLoading(true);
        setError("");

        const params = {
          page: currentPage,
          limit: PAGE_SIZE,
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        if (statusFilter !== "all") {
          params.status = statusFilter;
        }

        const response = await getSuppliers(selectedOrganizationId, params);

        if (isMounted) {
          setSuppliers(response?.data?.suppliers || []);
          setPagination(response?.data?.pagination || EMPTY_PAGINATION);
        }
      } catch (err) {
        if (isMounted) {
          setSuppliers([]);
          setPagination(EMPTY_PAGINATION);
          setError(err.message || "Unable to load suppliers.");
        }
      } finally {
        if (isMounted) {
          setIsSuppliersLoading(false);
        }
      }
    }

    loadSuppliers();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId, search, statusFilter, currentPage]);

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const userRole = selectedOrganization?.role;

  const canManageSuppliers = ["owner", "manager"].includes(userRole);

  function handleOrganizationChange(event) {
    const organizationId = event.target.value;

    setSelectedOrganizationId(organizationId);
    setCurrentPage(1);
    setSuppliers([]);
    setError("");

    if (organizationId) {
      localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
    } else {
      localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    }
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setCurrentPage(1);
  }

  function handleStatusChange(event) {
    setStatusFilter(event.target.value);
    setCurrentPage(1);
  }

  async function handleSupplierStatusChange(supplier) {
    if (userRole !== "owner" || updatingSupplierId) {
      return;
    }

    const nextStatus = supplier.status === "active" ? "inactive" : "active";

    const action = nextStatus === "inactive" ? "deactivate" : "activate";

    if (
      !window.confirm(`Are you sure you want to ${action} ${supplier.name}?`)
    ) {
      return;
    }

    try {
      setUpdatingSupplierId(supplier._id);
      setActionMessage("");
      setActionError("");

      await updateSupplierStatus(
        selectedOrganizationId,
        supplier._id,
        nextStatus,
      );

      const params = {
        page: currentPage,
        limit: PAGE_SIZE,
      };

      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;

      const response = await getSuppliers(selectedOrganizationId, params);

      setSuppliers(response?.data?.suppliers || []);
      setPagination(response?.data?.pagination || EMPTY_PAGINATION);

      setActionMessage(`${supplier.name} ${action}d successfully.`);
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update supplier status.",
      );
    } finally {
      setUpdatingSupplierId("");
    }
  }

  if (isLoading) {
    return (
      <main className="supplier-page supplier-skeleton-page">
        <header className="supplier-page-header">
          <div>
            <Skeleton width="160px" height="12px" />
            <Skeleton width="190px" height="32px" />
            <Skeleton width="280px" height="16px" />
          </div>
        </header>

        <section className="supplier-list-card">
          <Skeleton width="160px" height="22px" />
          <Skeleton width="260px" height="14px" />

          {Array.from({ length: 5 }).map((_, index) => (
            <div className="supplier-skeleton-row" key={index}>
              <Skeleton width="22%" height="16px" />
              <Skeleton width="18%" height="16px" />
              <Skeleton width="20%" height="16px" />
              <Skeleton width="12%" height="16px" />
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="supplier-page">
      <header className="supplier-page-header">
        <div>
          <p className="supplier-eyebrow">SUPPLIER MANAGEMENT</p>
          <h1>Suppliers</h1>
          <p className="supplier-subtitle">
            Manage your organization's supplier information.
          </p>

          {selectedOrganization && (
            <div className="supplier-context-info">
              <p>
                Organization:{" "}
                <strong>{selectedOrganization.organization.name}</strong>
              </p>

              <p>
                Your Role:{" "}
                <strong className="supplier-role-badge">
                  {userRole
                    ?.replaceAll("_", " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </strong>
              </p>
            </div>
          )}
        </div>
        {canManageSuppliers && (
          <button
            type="button"
            className="supplier-add-button"
            onClick={() => navigate("/suppliers/new")}
            disabled={!selectedOrganizationId}
          >
            + Add Supplier
          </button>
        )}
      </header>

      {organizations.length > 1 && (
        <section className="supplier-organization">
          <label htmlFor="supplier-organization">Select organization</label>

          <select
            id="supplier-organization"
            value={selectedOrganizationId}
            onChange={handleOrganizationChange}
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
        <div className="supplier-alert">
          No active organization is available for your account.
        </div>
      )}

      {error && (
        <div className="supplier-alert" role="alert">
          {error}
        </div>
      )}

      {selectedOrganizationId && (
        <section className="supplier-list-card">
          <div className="supplier-list-toolbar">
            <div>
              <h2>All Suppliers</h2>
              <p>{pagination.total} suppliers found</p>
            </div>

            <div className="supplier-filters">
              <input
                type="search"
                placeholder="Search suppliers..."
                value={search}
                onChange={handleSearchChange}
                aria-label="Search suppliers"
              />

              <select
                value={statusFilter}
                onChange={handleStatusChange}
                aria-label="Filter by supplier status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {actionMessage && (
            <div className="supplier-action-success" role="status">
              {actionMessage}
            </div>
          )}

          {actionError && (
            <div className="supplier-action-error" role="alert">
              {actionError}
            </div>
          )}

          {isSuppliersLoading ? (
            <div className="supplier-skeleton-table">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="supplier-skeleton-row" key={index}>
                  <Skeleton width="22%" height="16px" />
                  <Skeleton width="18%" height="16px" />
                  <Skeleton width="20%" height="16px" />
                  <Skeleton width="12%" height="16px" />
                </div>
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="supplier-empty-state">
              <h3>
                {search.trim() ? "No matching suppliers" : "No suppliers yet"}
              </h3>

              <p>
                {search.trim()
                  ? "Try changing your search or filters."
                  : "Suppliers you add will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="supplier-table-wrapper">
                <table className="supplier-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Contact Person</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>GSTIN</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier._id}>
                        <td>
                          <strong>{supplier.name}</strong>
                        </td>

                        <td>{supplier.contactPerson || "—"}</td>
                        <td>{supplier.phone || "—"}</td>
                        <td>{supplier.email || "—"}</td>
                        <td>{supplier.gstin || "—"}</td>

                        <td>
                          <span
                            className={`supplier-status supplier-status-${supplier.status}`}
                          >
                            {supplier.status}
                          </span>
                        </td>

                        <td>
                          <div className="supplier-row-actions">
                            <button
                              type="button"
                              className="supplier-view-button"
                              onClick={() =>
                                navigate(`/suppliers/${supplier._id}`)
                              }
                            >
                              View
                            </button>

                            {canManageSuppliers && (
                              <button
                                type="button"
                                className="supplier-edit-list-button"
                                onClick={() =>
                                  navigate(`/suppliers/${supplier._id}/edit`)
                                }
                              >
                                Edit
                              </button>
                            )}

                            {userRole === "owner" && (
                              <button
                                type="button"
                                className={`supplier-list-status-button ${
                                  supplier.status === "active"
                                    ? "deactivate"
                                    : "activate"
                                }`}
                                onClick={() =>
                                  handleSupplierStatusChange(supplier)
                                }
                                disabled={updatingSupplierId === supplier._id}
                              >
                                {updatingSupplierId === supplier._id
                                  ? "Updating..."
                                  : supplier.status === "active"
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="supplier-pagination">
                <span>
                  Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                </span>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={!pagination.hasPreviousPage}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => page + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
