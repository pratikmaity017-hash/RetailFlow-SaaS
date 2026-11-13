import { useState } from "react";

import { useAuth } from "../useAuth";
import { sendEmailVerification } from "../authService";
import { getAccessToken } from "../../../services/api/tokenStorage";

export default function EmailVerificationNotice() {
  const { user } = useAuth();

  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Do not display the notice for verified users.
  if (!user || user.emailVerifiedAt) {
    return null;
  }

  async function handleResend() {
    setError("");
    setMessage("");

    try {
      setIsSending(true);

      const accessToken = getAccessToken();

      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await sendEmailVerification(accessToken);

      setMessage(
        response.message ||
          "If your account has an unverified email address, a verification email will be sent.",
      );
    } catch (err) {
      setError(err.message || "Unable to send verification email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      className="email-verification-notice"
      aria-label="Email verification"
    >
      <div className="email-verification-content">
        <div className="email-verification-icon" aria-hidden="true">
          !
        </div>

        <div className="email-verification-text">
          <h3>Verify your email address</h3>

          <p>
            Your email address has not been verified yet. Verify it to keep your
            account information up to date.
          </p>

          {message && (
            <p className="email-verification-success" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="email-verification-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        className="email-verification-button"
        onClick={handleResend}
        disabled={isSending}
      >
        {isSending ? "Sending..." : "Resend verification email"}
      </button>
    </section>
  );
}
