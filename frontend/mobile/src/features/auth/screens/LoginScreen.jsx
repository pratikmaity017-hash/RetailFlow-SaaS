import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";

import AppScreen from "../../../components/layout/AppScreen";
import AppHeader from "../../../components/layout/AppHeader";
import AppCard from "../../../components/ui/AppCard";
import AppButton from "../../../components/ui/AppButton";
import AppTextInput from "../../../components/ui/AppTextInput";
import AppErrorState from "../../../components/common/AppErrorState";

import { loginUser } from "../authService";
import { useAuth } from "../AuthContext";
import { saveTokens } from "../../../services/api/tokenStorage";
import theme from "../../../theme";

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setLoading(true);

      const response = await loginUser({
        email: email.trim().toLowerCase(),
        password,
      });

      const user = response?.data?.user;
      const tokens = response?.data?.tokens;

      if (!user || !tokens?.accessToken || !tokens?.refreshToken) {
        throw new Error("Invalid login response from server.");
      }

      await saveTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      login(user);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen padding={theme.spacing.xxl}>
      <AppHeader
        title="Welcome back"
        subtitle="Sign in to your RetailFlow account"
      />

      <AppCard style={styles.card}>
        <Text style={styles.heading}>Sign in</Text>

        <AppTextInput
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          editable={!loading}
        />

        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
        />

        <Text style={styles.footer}>Don't have an account?</Text>

        <AppButton
          title="Create Account"
          variant="outline"
          disabled={loading}
          onPress={() => navigation.navigate("Register")}
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
  },
  heading: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  footer: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.danger,
  },
});
