import { Link, useNavigate } from "react-router-dom";

import "./page-not-found.css";

export default function PageNotFound() {
  const navigate = useNavigate();

  return (
    <main className="not-found-page">
      <div className="not-found-content">
        <Link to="/dashboard" className="not-found-brand">
          <span className="not-found-brand-icon">R</span>
          <span>RetailFlow</span>
        </Link>

        <div className="not-found-visual" aria-hidden="true">
          <span className="not-found-decoration decoration-one" />
          <span className="not-found-decoration decoration-two" />
          <span className="not-found-decoration decoration-three" />

          <span className="not-found-number">4</span>

          <div className="not-found-center">
            <span>?</span>
          </div>

          <span className="not-found-number">4</span>
        </div>

        <p className="not-found-eyebrow">ERROR 404</p>

        <h1>Page not found</h1>

        <p className="not-found-description">
          The page you're looking for doesn't exist, may have been moved, or the
          URL might be incorrect.
        </p>

        <div className="not-found-actions">
          <Link to="/dashboard" className="not-found-primary-button">
            <span aria-hidden="true">←</span>
            Back to Dashboard
          </Link>

          <button
            type="button"
            className="not-found-secondary-button"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>

        <p className="not-found-footer">
          Need help? Return to your RetailFlow workspace.
        </p>
      </div>
    </main>
  );
}
