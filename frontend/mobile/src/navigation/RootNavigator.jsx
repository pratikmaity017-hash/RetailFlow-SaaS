import { useAuth } from "../features/auth/AuthContext";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import AppLoader from "../components/ui/AppLoader";

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader message="Loading your account..." />;
  }

  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
}
