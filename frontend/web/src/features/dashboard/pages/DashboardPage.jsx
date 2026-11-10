import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import {
  getUserOrganizations,
  getOrganizationContext,
} from "../../organization/organizationService";
import { getProducts } from "../../products/productService";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [organizationContext, setOrganizationContext] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsOrganizationId, setProductsOrganizationId] = useState("");
  const [productsError, setProductsError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        setIsLoading(true);
        setError("");

        const response = await getUserOrganizations();
        const availableOrganizations = response?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        if (availableOrganizations.length === 1) {
          setSelectedOrganizationId(availableOrganizations[0].organization.id);
        } else if (availableOrganizations.length === 0) {
          setError("No active organization is available for your account.");
        }
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
    if (!selectedOrganizationId) {
      return;
    }

    let isMounted = true;

    async function loadOrganizationContext() {
      try {
        setError("");

        const response = await getOrganizationContext(selectedOrganizationId);

        if (isMounted) {
          setOrganizationContext(response?.data || null);
        }
      } catch (err) {
        if (isMounted) {
          setOrganizationContext(null);
          setError(err.message || "Unable to load organization details.");
        }
      }
    }

    loadOrganizationContext();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId) {
      return;
    }

    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await getProducts(selectedOrganizationId);

        if (isMounted) {
          setProducts(response?.data?.products || []);
          setProductsOrganizationId(selectedOrganizationId);
          setProductsError("");
        }
      } catch (err) {
        if (isMounted) {
          setProductsOrganizationId(selectedOrganizationId);
          setProductsError(err.message || "Unable to load products.");
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  const productDataReady = productsOrganizationId === selectedOrganizationId;

  const activeProducts = products.filter(
    (product) => product.status === "active",
  ).length;

  const inactiveProducts = products.filter(
    (product) => product.status === "inactive",
  ).length;

  const userRole = organizationContext?.membership?.role;

  if (isLoading) {
    return (
      <main className="dashboard-placeholder">
        <p>Loading your organization...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-placeholder">
      <h1>Welcome to RetailFlow</h1>

      {location.state?.message && (
        <div className="auth-success" role="status">
          {location.state.message}
        </div>
      )}

      <p>User ID: {user?.userId}</p>

      {error && <div role="alert">{error}</div>}

      {organizations.length > 1 && (
        <div>
          <label htmlFor="organization-select">Select organization</label>

          <select
            id="organization-select"
            value={selectedOrganizationId}
            onChange={(event) => setSelectedOrganizationId(event.target.value)}
          >
            <option value="">Choose an organization</option>

            {organizations.map((item) => (
              <option key={item.organization.id} value={item.organization.id}>
                {item.organization.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {organizationContext && (
        <section>
          <h2>{organizationContext.organization.name}</h2>
          <p>Your role: {userRole}</p>
        </section>
      )}

      <section>
        <h2>Business Overview</h2>

        {!selectedOrganizationId && (
          <p>Select an organization to view its statistics.</p>
        )}

        {selectedOrganizationId && !productDataReady && (
          <p>Loading product statistics...</p>
        )}

        {productDataReady && productsError && (
          <div role="alert">{productsError}</div>
        )}

        {productDataReady && !productsError && (
          <div>
            {userRole === "sales_staff" ? (
              <p>
                Active Products: <strong>{activeProducts}</strong>
              </p>
            ) : (
              <>
                <p>
                  Total Products: <strong>{products.length}</strong>
                </p>

                <p>
                  Active Products: <strong>{activeProducts}</strong>
                </p>

                <p>
                  Inactive Products: <strong>{inactiveProducts}</strong>
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <button type="button" onClick={logout}>
        Logout
      </button>
    </main>
  );
}
