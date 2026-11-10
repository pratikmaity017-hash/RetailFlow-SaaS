import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppScreen from "../../../components/layout/AppScreen";
import AppHeader from "../../../components/layout/AppHeader";
import AppCard from "../../../components/ui/AppCard";
import AppButton from "../../../components/ui/AppButton";

import { useAuth } from "../../auth/AuthContext";
import {
  getUserOrganizations,
  getOrganizationContext,
} from "../../organization/organizationService";
import { getProducts } from "../../products/productService";

import theme from "../../../theme";

export default function DashboardScreen() {
  const { logout } = useAuth();

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const [organizationContext, setOrganizationContext] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsOrganizationId, setProductsOrganizationId] = useState("");
  const [productsError, setProductsError] = useState("");

  const [isOrganizationsLoading, setIsOrganizationsLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState("");
  const [contextError, setContextError] = useState("");

  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load organizations belonging to the authenticated user.
  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        setOrganizationError("");

        const response = await getUserOrganizations();
        const availableOrganizations = response?.data?.organizations || [];

        if (!isMounted) return;

        setOrganizations(availableOrganizations);

        if (availableOrganizations.length === 1) {
          setSelectedOrganizationId(availableOrganizations[0].organization.id);
        } else {
          setSelectedOrganizationId("");
        }
      } catch (error) {
        if (isMounted) {
          setOrganizationError(
            error.message || "Unable to load organizations.",
          );
        }
      } finally {
        if (isMounted) {
          setIsOrganizationsLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  // Load the selected organization's verified context.
  useEffect(() => {
    if (!selectedOrganizationId) return;

    let isMounted = true;

    async function loadOrganizationContext() {
      try {
        setContextError("");

        const response = await getOrganizationContext(selectedOrganizationId);

        if (isMounted) {
          setOrganizationContext(response?.data || null);
        }
      } catch (error) {
        if (isMounted) {
          setOrganizationContext(null);
          setContextError(
            error.message || "Unable to load organization details.",
          );
        }
      }
    }

    loadOrganizationContext();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  // Load products belonging to the selected organization.
  useEffect(() => {
    if (!selectedOrganizationId) return;

    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await getProducts(selectedOrganizationId);

        if (isMounted) {
          setProducts(response?.data?.products || []);
          setProductsOrganizationId(selectedOrganizationId);
          setProductsError("");
        }
      } catch (error) {
        if (isMounted) {
          setProductsOrganizationId(selectedOrganizationId);
          setProductsError(error.message || "Unable to load products.");
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganizationId]);

  const handleOrganizationSelect = (organizationId) => {
    setSelectedOrganizationId(organizationId);
    setOrganizationContext(null);
    setContextError("");
  };

  const handleRetry = () => {
    setOrganizationError("");
    setIsOrganizationsLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);
            await logout();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const selectedOrganization = organizations.find(
    (item) => item.organization.id === selectedOrganizationId,
  );

  const isContextReady =
    organizationContext?.organization?.id === selectedOrganizationId;

  const isProductsReady = productsOrganizationId === selectedOrganizationId;

  const activeProducts = products.filter(
    (product) => product.status === "active",
  ).length;

  const inactiveProducts = products.filter(
    (product) => product.status === "inactive",
  ).length;

  const userRole = organizationContext?.membership?.role;

  return (
    <AppScreen padding={0}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <AppHeader title="Dashboard" subtitle="Your business at a glance" />

        <Text style={styles.sectionTitle}>Your Organization</Text>

        {isOrganizationsLoading ? (
          <AppCard style={styles.statusCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.statusText}>Loading your organizations...</Text>
          </AppCard>
        ) : organizationError ? (
          <AppCard style={styles.statusCard}>
            <Text style={styles.errorText}>{organizationError}</Text>

            <AppButton title="Try Again" onPress={handleRetry} />
          </AppCard>
        ) : organizations.length === 0 ? (
          <AppCard style={styles.statusCard}>
            <Text style={styles.statusText}>
              No active organization is available for your account.
            </Text>
          </AppCard>
        ) : (
          <>
            {organizations.length > 1 && (
              <View style={styles.organizationList}>
                <Text style={styles.helperText}>
                  Select an organization to continue:
                </Text>

                {organizations.map((item) => {
                  const isSelected =
                    item.organization.id === selectedOrganizationId;

                  return (
                    <Pressable
                      key={item.organization.id}
                      onPress={() =>
                        handleOrganizationSelect(item.organization.id)
                      }
                    >
                      <AppCard
                        style={[
                          styles.organizationCard,
                          isSelected && styles.selectedCard,
                        ]}
                      >
                        <Text style={styles.organizationName}>
                          {item.organization.name}
                        </Text>

                        <Text style={styles.roleText}>
                          Role: {item.role.replace("_", " ")}
                        </Text>

                        {isSelected && (
                          <Text style={styles.selectedText}>Selected</Text>
                        )}
                      </AppCard>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {organizations.length === 1 && (
              <AppCard style={styles.organizationCard}>
                <Text style={styles.organizationName}>
                  {organizations[0].organization.name}
                </Text>

                <Text style={styles.roleText}>
                  Role: {organizations[0].role.replace("_", " ")}
                </Text>
              </AppCard>
            )}

            {selectedOrganization && (
              <AppCard style={styles.contextCard}>
                {isContextReady ? (
                  <>
                    <Text style={styles.contextTitle}>
                      Organization Access Verified
                    </Text>

                    <Text style={styles.contextText}>
                      {organizationContext.organization.name}
                    </Text>

                    <Text style={styles.roleText}>
                      Your role:{" "}
                      {organizationContext.membership.role.replace("_", " ")}
                    </Text>
                  </>
                ) : contextError ? (
                  <Text style={styles.errorText}>{contextError}</Text>
                ) : (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={styles.statusText}>
                      Verifying organization access...
                    </Text>
                  </View>
                )}
              </AppCard>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Business Overview</Text>

        <AppCard style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>Product Statistics</Text>

          {!selectedOrganizationId ? (
            <Text style={styles.overviewText}>
              Select an organization to view product statistics.
            </Text>
          ) : !isProductsReady ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.overviewText}>
                Loading product statistics...
              </Text>
            </View>
          ) : productsError ? (
            <Text style={styles.errorText}>{productsError}</Text>
          ) : userRole === "sales_staff" ? (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Active Products</Text>
              <Text style={styles.statValue}>{activeProducts}</Text>
            </View>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Products</Text>
                <Text style={styles.statValue}>{products.length}</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Active Products</Text>
                <Text style={styles.statValue}>{activeProducts}</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Inactive Products</Text>
                <Text style={styles.statValue}>{inactiveProducts}</Text>
              </View>
            </>
          )}
        </AppCard>

        <View style={styles.logoutContainer}>
          <AppButton
            title="Logout"
            variant="outline"
            onPress={handleLogout}
            loading={loggingOut}
            disabled={loggingOut}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.xxl,
    paddingTop: theme.spacing.xxxl,
    paddingBottom: theme.spacing.xxxl,
  },

  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },

  statusCard: {
    gap: theme.spacing.md,
    alignItems: "center",
  },

  statusText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.danger,
    textAlign: "center",
  },

  helperText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },

  organizationList: {
    gap: theme.spacing.md,
  },

  organizationCard: {
    gap: theme.spacing.sm,
  },

  selectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },

  organizationName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },

  roleText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },

  selectedText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
  },

  contextCard: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },

  contextTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.success,
  },

  contextText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },

  overviewCard: {
    gap: theme.spacing.md,
  },

  overviewTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },

  overviewText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  statItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },

  statValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },

  logoutContainer: {
    marginTop: theme.spacing.xxl,
  },
});
