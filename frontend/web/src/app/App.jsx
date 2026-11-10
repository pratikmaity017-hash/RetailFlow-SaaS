import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "../features/auth/AuthContext.jsx";
import AppRoutes from "../routes/AppRoutes";

import "../features/auth/auth.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
