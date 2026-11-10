import { StyleSheet, Text, View } from "react-native";
import theme from "../../theme";
import AppButton from "../ui/AppButton";

export default function AppErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to load data</Text>

      <Text style={styles.message}>{message}</Text>

      {onRetry ? (
        <AppButton title="Try Again" onPress={onRetry} variant="outline" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
});
