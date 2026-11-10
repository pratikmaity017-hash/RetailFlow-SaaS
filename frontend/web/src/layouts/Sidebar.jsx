import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";

const navigationItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "dashboard",
    available: true,
  },
  { label: "Products", path: "/products", icon: "products", available: true },
  { label: "Inventory", icon: "inventory", available: false },
  { label: "Sales", icon: "sales", available: false },
  { label: "Customers", icon: "customers", available: false },
  { label: "Suppliers", icon: "suppliers", available: false },
  { label: "Purchases", icon: "purchases", available: false },
  { label: "Team Members", icon: "team", available: false },
  { label: "Settings", icon: "settings", available: false },
];

const iconPaths = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  products: [
    "M12 3 3 8l9 5 9-5-9-5Z",
    "m3 8 9 5 9-5",
    "M3 8v9l9 5 9-5V8",
    "M12 13v9",
  ],
  inventory: ["M3 7h18", "M5 3h14v18H5z", "M9 11h6", "M9 15h6"],
  sales: ["M3 17 9 11l4 4 8-9", "M15 6h6v6"],
  customers: [
    "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
    "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M20 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  suppliers: [
    "M3 7h13v11H3z",
    "M16 11h3l3 3v4h-6",
    "M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  ],
  purchases: ["M4 4h16v16H4z", "M8 8h8", "M8 12h8", "M8 16h5"],
  team: [
    "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
    "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M19 8v6",
    "M16 11h6",
  ],
  settings: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.02a1.7 1.7 0 0 0-1.8.58l-.05.07h-3.4l-.05-.07a1.7 1.7 0 0 0-1.8-.58l-.08.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 9.6 15l-.08-.04v-3.4l.08-.04a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-2.94.08.02a1.7 1.7 0 0 0 1.8-.58l.05-.07h3.4l.05.07a1.7 1.7 0 0 0 1.8.58l.08-.02 1.7 2.94-.06.06a1.7 1.7 0 0 0-.34 1.88l.08.04v3.4l-.08.04Z",
  ],
  logout: [
    "M10 17l5-5-5-5",
    "M15 12H3",
    "M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6",
  ],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["m18 6-12 12", "M6 6l12 12"],
  collapse: ["m15 18-6-6 6-6"],
  expand: ["m9 18 6-6-6-6"],
};

function SidebarIcon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]?.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}

export default function Sidebar() {
  const { logout } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("retailflow-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const showLabels = !isCollapsed || isMobileOpen;

  function toggleSidebar() {
    setIsCollapsed((previousState) => {
      const nextState = !previousState;

      try {
        localStorage.setItem("retailflow-sidebar-collapsed", String(nextState));
      } catch {
        // Sidebar remains functional if storage is unavailable.
      }

      return nextState;
    });
  }

  function closeMobileSidebar() {
    setIsMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen((previous) => !previous)}
        aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isMobileOpen}
      >
        <SidebarIcon name={isMobileOpen ? "close" : "menu"} size={21} />
      </button>

      {isMobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={closeMobileSidebar}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? "collapsed" : ""} ${
          isMobileOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">R</div>

          {showLabels && (
            <div className="sidebar-brand-text">
              <h2>RetailFlow</h2>
              <p>Retail management platform</p>
            </div>
          )}

          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <SidebarIcon name={isCollapsed ? "expand" : "collapse"} size={18} />
          </button>
        </div>

        <div className="sidebar-navigation">
          {showLabels && <p className="sidebar-section-label">WORKSPACE</p>}

          <nav aria-label="Main navigation">
            {navigationItems.map((item) => {
              const itemClass = `sidebar-nav-item ${
                isCollapsed ? "icon-only" : ""
              }`;

              if (item.available) {
                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end={item.path === "/dashboard"}
                    onClick={closeMobileSidebar}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `${itemClass} ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-nav-icon">
                      <SidebarIcon name={item.icon} />
                    </span>

                    {showLabels && (
                      <span className="sidebar-nav-label">{item.label}</span>
                    )}
                  </NavLink>
                );
              }

              return (
                <div
                  key={item.label}
                  className={`${itemClass} disabled`}
                  title={`${item.label} - Coming soon`}
                  aria-disabled="true"
                >
                  <span className="sidebar-nav-icon">
                    <SidebarIcon name={item.icon} />
                  </span>

                  {showLabels && (
                    <>
                      <span className="sidebar-nav-label">{item.label}</span>
                      <span className="sidebar-coming-soon">Soon</span>
                    </>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          {showLabels && (
            <div className="sidebar-footer-info">
              <div className="sidebar-footer-mark">RF</div>
              <div>
                <strong>RetailFlow SaaS</strong>
                <span>Manage your business</span>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`sidebar-logout-button ${
              isCollapsed ? "icon-only" : ""
            }`}
            onClick={logout}
            title={isCollapsed ? "Logout" : undefined}
          >
            <span className="sidebar-logout-icon">
              <SidebarIcon name="logout" />
            </span>
            {showLabels && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
