import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import EmailVerificationNotice from "../features/auth/components/EmailVerificationNotice";

import "./sidebar.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout-content">
        <EmailVerificationNotice />

        <Outlet />
      </div>
    </div>
  );
}
