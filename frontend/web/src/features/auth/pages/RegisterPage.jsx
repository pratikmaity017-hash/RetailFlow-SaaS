import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "../authService";
import GoogleSignInButton from "../components/GoogleSignInButton";

function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();

    if (!name || !email || !formData.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);

      await registerUser({
        name,
        email,
        password: formData.password,
      });

      navigate("/login", {
        replace: true,
        state: {
          message: "Account created successfully. Please sign in.",
          email,
        },
      });
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <aside className="auth-showcase">
          <Link to="/register" className="auth-brand">
            <span className="auth-brand-icon">R</span>
            <span>RetailFlow</span>
          </Link>

          <div className="auth-showcase-content">
            <span className="auth-eyebrow">YOUR BUSINESS STARTS HERE</span>

            <h1>
              One account.
              <span> Multiple possibilities.</span>
            </h1>

            <p>
              Create your RetailFlow account and build a workspace that grows
              with your business.
            </p>

            <div className="auth-showcase-features">
              <div>
                <span className="auth-feature-icon">✓</span>
                <span>Create your account in minutes</span>
              </div>

              <div>
                <span className="auth-feature-icon">✓</span>
                <span>Manage multiple organizations</span>
              </div>

              <div>
                <span className="auth-feature-icon">✓</span>
                <span>Bring your team together</span>
              </div>
            </div>
          </div>

          <p className="auth-showcase-footer">
            © {new Date().getFullYear()} RetailFlow. All rights reserved.
          </p>
        </aside>

        <div className="auth-main">
          <section className="auth-card auth-card-register">
            <div className="auth-mobile-brand">
              <span className="auth-brand-icon">R</span>
              <span>RetailFlow</span>
            </div>

            <div className="auth-heading">
              <span className="auth-form-eyebrow">GET STARTED</span>
              <h2>Create your account</h2>
              <p>Enter your details to get started with RetailFlow.</p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="name">Full name</label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>

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
                <label htmlFor="password">Password</label>

                <div className="auth-password-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    minLength={8}
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

              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirm password</label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Enter your password again"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <button
                className="auth-submit"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Create account"}
                {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <GoogleSignInButton text="signup_with" />

            <p className="auth-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </section>

          <p className="auth-mobile-footer">
            Your business workspace, your way.
          </p>
        </div>
      </section>
    </main>
  );
}

export default RegisterPage;
