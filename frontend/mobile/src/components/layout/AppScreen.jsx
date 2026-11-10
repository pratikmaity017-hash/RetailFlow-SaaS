import { StyleSheet, View } from "react-native";
import theme from "../../theme";

export default function AppScreen({
  children,
  padding = theme.spacing.lg,
  style,
}) {
  return <View style={[styles.container, { padding }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
