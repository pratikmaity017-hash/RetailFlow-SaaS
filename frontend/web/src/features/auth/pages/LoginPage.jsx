import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../useAuth";
import { loginUser } from "../authService";
import { saveTokens } from "../../../services/api/tokenStorage";
import GoogleSignInButton from "../components/GoogleSignInButton";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    password: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const successMessage = location.state?.message;

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const email = formData.email.trim().toLowerCase();

    if (!email || !formData.password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await loginUser({
        email,
        password: formData.password,
      });

      const { user, tokens } = response.data;

      saveTokens(tokens);
      login(user);

      navigate("/dashboard", {
        replace: true,
        state: {
          message: "Login successful! Welcome to RetailFlow.",
        },
      });
    } catch (err) {
      setError(err.message || "Unable to login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <aside className="auth-showcase">
          <Link to="/login" className="auth-brand">
            <span className="auth-brand-icon">R</span>
            <span>RetailFlow</span>
          </Link>

          <div className="auth-showcase-content">
            <span className="auth-eyebrow">RETAIL MANAGEMENT PLATFORM</span>

            <h1>
              Run your retail business.
              <span> All in one place.</span>
            </h1>

            <p>
              Simplify your operations, manage your products, and keep your
              business moving forward with RetailFlow.
            </p>

            <div className="auth-showcase-features">
              <div>
                <span className="auth-feature-icon">✓</span>
                <span>Centralized business management</span>
              </div>

              <div>
                <span className="auth-feature-icon">✓</span>
                <span>Organized inventory and products</span>
              </div>

              <div>
                <span className="auth-feature-icon">✓</span>
                <span>Built for growing retail businesses</span>
              </div>
            </div>
          </div>

          <p className="auth-showcase-footer">
            © {new Date().getFullYear()} RetailFlow. All rights reserved.
          </p>
        </aside>

        <div className="auth-main">
          <section className="auth-card">
            <div className="auth-mobile-brand">
              <span className="auth-brand-icon">R</span>
              <span>RetailFlow</span>
            </div>

            <div className="auth-heading">
              <span className="auth-form-eyebrow">WELCOME BACK</span>
              <h2>Sign in to your account</h2>
              <p>Enter your credentials to access your workspace.</p>
            </div>

            {successMessage && (
              <div className="auth-success" role="status">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="email">Email address</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="password">Password</label>
                </div>

                <div className="auth-password-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                className="auth-submit"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
                {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <GoogleSignInButton text="signin_with" />

            <p className="auth-footer">
              Don't have an account?{" "}
              <Link to="/register">Create an account</Link>
            </p>
          </section>

          <p className="auth-mobile-footer">
            Secure access to your RetailFlow workspace.
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
