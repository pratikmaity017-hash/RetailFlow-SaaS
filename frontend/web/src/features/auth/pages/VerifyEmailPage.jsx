import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { verifyEmail } from "../authService";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const verificationStarted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    if (verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;

    async function verify() {
      try {
        const response = await verifyEmail(token);

        setStatus("success");
        setMessage(
          response.message || "Your email has been verified successfully.",
        );
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Unable to verify your email address.");
      }
    }

    verify();
  }, [token]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">R</div>
          <span>RetailFlow</span>
        </div>

        <div className="auth-heading">
          <h1>
            {status === "loading" && "Verifying your email"}
            {status === "success" && "Email verified!"}
            {status === "error" && "Verification unsuccessful"}
          </h1>

          <p>
            {status === "loading" &&
              "Please wait while we verify your email address."}

            {status === "success" &&
              "Your email address is now verified. You can sign in to RetailFlow."}

            {status === "error" && message}
          </p>
        </div>

        {status === "loading" && (
          <div className="auth-success" role="status">
            Processing your verification...
          </div>
        )}

        {status === "success" && (
          <div className="auth-success" role="status">
            {message}
          </div>
        )}

        {status === "error" && (
          <div className="auth-error" role="alert">
            {message}
          </div>
        )}

        {status !== "loading" && (
          <Link to="/login" className="auth-submit">
            Continue to sign in
          </Link>
        )}
      </section>
    </main>
  );
}

export default VerifyEmailPage;
