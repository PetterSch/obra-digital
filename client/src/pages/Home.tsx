import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Building2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      navigate(isAuthenticated ? "/dashboard" : "/login", { replace: true });
    }
  }, [loading, isAuthenticated]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
