import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function useAuth({ redirectOnUnauthenticated = false } = {}) {
  const [, navigate] = useLocation();
  const { data: user, isLoading: loading, error } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/login"),
  });

  const isAuthenticated = !!user;

  useEffect(() => {
    if (!loading && !isAuthenticated && redirectOnUnauthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, redirectOnUnauthenticated]);

  return {
    user: user ?? null,
    loading,
    error,
    isAuthenticated,
    logout: () => logoutMutation.mutate(),
  };
}
