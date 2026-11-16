import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCustomers, deactivateCustomer ,updateCustomer } from "../customerService";
import { getUserOrganizations } from "../../organization/organizationService";

import Skeleton from "../../../shared/components/Skeleton";
import "./customer-list.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";
const PAGE_SIZE = 20;

export default function CustomerListPage() {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: PAGE_SIZE,
    totalCustomers: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);

  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deactivatingCustomerId, setDeactivatingCustomerId] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  // Load organizations available to the authenticated user.
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

  // Load customers whenever organization, search, status or page changes.
  useEffect(() => {
    if (!selectedOrganizationId) return;

    let isMounted = true;

    async function loadCustomers() {
      try {
        setIsCustomersLoading(true);
        setError("");
        setActionError("");

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

        const response = await getCustomers(selectedOrganizationId, params);

        if (isMounted) {
          setCustomers(response?.data?.customers || []);

          setPagination(
            response?.data?.pagination || {
              currentPage: 1,
              pageSize: PAGE_SIZE,
              totalCustomers: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          );
        }
      } catch (err) {
        if (isMounted) {
          setCustomers([]);
          setPagination({
            currentPage: 1,
            pageSize: PAGE_SIZE,
            totalCustomers: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          });
          setError(err.message || "Unable to load customers.");
        }
      } finally {
        if (isMounted) {
          setIsCustomersLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId, search, statusFilter, currentPage]);

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const userRole = selectedOrganization?.role;

  const canManageCustomers = ["owner", "manager"].includes(userRole);
  const canDeactivateCustomers = userRole === "owner";

  function handleOrganizationChange(event) {
    const organizationId = event.target.value;

    setSelectedOrganizationId(organizationId);
    setCurrentPage(1);
    setCustomers([]);
    setError("");
    setActionError("");

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

  async function handleDeactivateCustomer(customer) {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${customer.name}"?`,
    );

    if (!confirmed) return;

    try {
      setActionError("");
      setDeactivatingCustomerId(customer._id);

      await deactivateCustomer(selectedOrganizationId, customer._id);

      setCustomers((currentCustomers) =>
        currentCustomers.filter((item) => item._id !== customer._id),
      );

      setPagination((current) => ({
        ...current,
        totalCustomers: Math.max(0, current.totalCustomers - 1),
      }));
    } catch (err) {
      setActionError(err.message || "Unable to deactivate customer.");
    } finally {
      setDeactivatingCustomerId("");
    }
  }

  async function handleReactivateCustomer(customer) {
    try {
      await updateCustomer(organizationId, customer._id, { status: "active" });

      setCustomers((current) =>
        current.map((item) =>
          item._id === customer._id ? { ...item, status: "active" } : item,
        ),
      );
    } catch (err) {
      setError(err.message || "Unable to reactivate customer.");
    }
  }

  if (isLoading) {
    return (
      <main className="customer-page customer-skeleton-page">
        <header className="customer-page-header">
          <div>
            <Skeleton width="150px" height="12px" />
            <Skeleton width="190px" height="32px" />
            <Skeleton width="280px" height="16px" />
          </div>

          <Skeleton width="140px" height="42px" />
        </header>

        <section className="customer-list-card">
          <Skeleton width="160px" height="22px" />
          <Skeleton width="260px" height="14px" />

          {Array.from({ length: 5 }).map((_, index) => (
            <div className="customer-skeleton-row" key={index}>
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
    <main className="customer-page">
      <header className="customer-page-header">
        <div>
          <p className="customer-eyebrow">CUSTOMER MANAGEMENT</p>
          <h1>Customers</h1>
          <p className="customer-subtitle">
            Manage your organization's customer information.
          </p>

          {selectedOrganization && (
            <div className="customer-context-info">
              <p>
                Organization:{" "}
                <strong>{selectedOrganization.organization.name}</strong>
              </p>

              <p>
                Your Role:{" "}
                <strong className="customer-role-badge">
                  {userRole
                    ?.replaceAll("_", " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </strong>
              </p>
            </div>
          )}
        </div>

        {canManageCustomers && (
          <button
            type="button"
            className="customer-primary-button"
            onClick={() => navigate("/customers/new")}
            disabled={!selectedOrganizationId}
          >
            + Add Customer
          </button>
        )}
      </header>

      {organizations.length > 1 && (
        <section className="customer-organization">
          <label htmlFor="customer-organization">Select organization</label>

          <select
            id="customer-organization"
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
        <div className="customer-alert">
          No active organization is available for your account.
        </div>
      )}

      {error && (
        <div className="customer-alert" role="alert">
          {error}
        </div>
      )}

      {actionError && (
        <div className="customer-alert" role="alert">
          {actionError}
        </div>
      )}

      {selectedOrganizationId && (
        <section className="customer-list-card">
          <div className="customer-list-toolbar">
            <div>
              <h2>All Customers</h2>
              <p>{pagination.totalCustomers} customers found</p>
            </div>

            <div className="customer-filters">
              <input
                type="search"
                placeholder="Search customers..."
                value={search}
                onChange={handleSearchChange}
                aria-label="Search customers"
              />

              {canManageCustomers && (
                <select
                  value={statusFilter}
                  onChange={handleStatusChange}
                  aria-label="Filter by customer status"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}
            </div>
          </div>

          {isCustomersLoading ? (
            <div className="customer-skeleton-table">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="customer-skeleton-row" key={index}>
                  <Skeleton width="22%" height="16px" />
                  <Skeleton width="18%" height="16px" />
                  <Skeleton width="20%" height="16px" />
                  <Skeleton width="12%" height="16px" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="customer-empty-state">
              <h3>
                {search.trim() ? "No matching customers" : "No customers yet"}
              </h3>

              <p>
                {search.trim()
                  ? "Try changing your search or filters."
                  : "Customers you add will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="customer-table-wrapper">
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer._id}>
                        <td>
                          <strong>{customer.name}</strong>
                        </td>

                        <td>{customer.phone || "—"}</td>
                        <td>{customer.email || "—"}</td>

                        <td>
                          <span
                            className={`customer-status customer-status-${customer.status}`}
                          >
                            {customer.status}
                          </span>
                        </td>

                        <td>
                          {customer.createdAt
                            ? new Date(customer.createdAt).toLocaleDateString()
                            : "—"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="customer-view-button"
                            onClick={() =>
                              navigate(`/customers/${customer._id}`)
                            }
                          >
                            View Details
                          </button>

                          {canDeactivateCustomers &&
                            customer.status === "active" && (
                              <button
                                type="button"
                                className="customer-deactivate-button"
                                onClick={() =>
                                  handleDeactivateCustomer(customer)
                                }
                                disabled={
                                  deactivatingCustomerId === customer._id
                                }
                              >
                                {deactivatingCustomerId === customer._id
                                  ? "Deactivating..."
                                  : "Deactivate"}
                              </button>
                            )}
                          {canDeactivateCustomers &&
                            customer.status === "inactive" && (
                              <button
                                type="button"
                                className="customer-reactivate-button"
                                onClick={() =>
                                  handleReactivateCustomer(customer)
                                }
                              >
                                Reactivate
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="customer-pagination">
                <span>
                  Page {pagination.currentPage} of{" "}
                  {Math.max(1, pagination.totalPages)}
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
