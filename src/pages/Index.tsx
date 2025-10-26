import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import DashboardPPPK from "./DashboardPPPK";
import DashboardAdmin from "./DashboardAdmin";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Route based on user role
  if (userRole === 'admin_bkd') {
    return <DashboardAdmin />;
  }

  return <DashboardPPPK />;
};

export default Index;
