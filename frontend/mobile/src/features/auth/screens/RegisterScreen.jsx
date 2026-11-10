import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";

import AppScreen from "../../../components/layout/AppScreen";
import AppHeader from "../../../components/layout/AppHeader";
import AppCard from "../../../components/ui/AppCard";
import AppButton from "../../../components/ui/AppButton";
import AppTextInput from "../../../components/ui/AppTextInput";

import { registerUser } from "../authService";
import theme from "../../../theme";

export default function RegisterScreen() {
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");

    if (
      !name.trim() ||
      !email.trim() ||
      !organizationName.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        organizationName: organizationName.trim(),
        password,
      });

      Alert.alert(
        "Registration successful",
        "Your RetailFlow account has been created. Please sign in.",
        [
          {
            text: "Continue",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen padding={theme.spacing.xxl}>
      <AppHeader
        title="Create your account"
        subtitle="Set up your RetailFlow workspace"
      />

      <AppCard style={styles.card}>
        <Text style={styles.heading}>Get started</Text>

        <AppTextInput
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          autoCapitalize="words"
          editable={!loading}
        />

        <AppTextInput
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          editable={!loading}
        />

        <AppTextInput
          label="Organization name"
          value={organizationName}
          onChangeText={setOrganizationName}
          placeholder="Enter your business name"
          autoCapitalize="words"
          editable={!loading}
        />

        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          secureTextEntry
          editable={!loading}
        />

        <AppTextInput
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter your password"
          secureTextEntry
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          title="Create Account"
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
        />

        <Text style={styles.footer}>Already have an account?</Text>

        <AppButton
          title="Sign In"
          variant="outline"
          disabled={loading}
          onPress={() => navigation.goBack()}
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
