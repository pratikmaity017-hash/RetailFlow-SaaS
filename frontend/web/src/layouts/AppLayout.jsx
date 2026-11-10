import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import "./sidebar.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  );
}
