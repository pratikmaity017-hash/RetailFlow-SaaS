import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import { useAuth } from "../useAuth";
import { googleLogin } from "../authService";
import { saveTokens } from "../../../services/api/tokenStorage";

function GoogleSignInButton({ text = "signin_with" }) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSuccess(credentialResponse) {
    setError("");

    const idToken = credentialResponse.credential;

    if (!idToken) {
      setError("Google authentication failed. Please try again.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await googleLogin(idToken);
      const { user, tokens } = response.data;

      saveTokens(tokens);
      login(user);

      navigate("/dashboard", {
        replace: true,
        state: {
          message: "Google sign-in successful! Welcome to RetailFlow.",
        },
      });
    } catch (err) {
      const errorCode = err.response?.data?.code;

      if (errorCode === "GOOGLE_ACCOUNT_LINK_REQUIRED") {
        setError(
          "An account already exists with this email. Please sign in using your email and password first.",
        );
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Google sign-in failed. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-google-section">
      <div className="auth-divider">
        <span>OR CONTINUE WITH</span>
      </div>

      <div className="auth-google-button">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => {
            setError("Google authentication failed. Please try again.");
          }}
          text={text}
          shape="rectangular"
          theme="outline"
          size="large"
          width="320"
        />
      </div>

      {isSubmitting && (
        <p className="auth-google-loading">Signing in with Google...</p>
      )}

      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;
