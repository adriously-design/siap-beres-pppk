import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FileCheck, LogOut, User, LayoutDashboard, Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
interface DocumentStats {
  pending: number;
  verified: number;
  rejected: number;
}
export const Navbar = () => {
  const {
    user,
    userRole,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);
  const [docStats, setDocStats] = useState<DocumentStats>({
    pending: 0,
    verified: 0,
    rejected: 0
  });
  useEffect(() => {
    const fetchProfile = async () => {
      if (user && userRole === 'calon_pppk') {
        const {
          data
        } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (data) {
          setFullName(data.full_name);
        }
      }
    };
    fetchProfile();
  }, [user, userRole]);
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      if (userRole === 'admin_bkd') {
        // Fetch pending documents count for admin
        const {
          data
        } = await supabase.from('user_dokumen').select('id', {
          count: 'exact',
          head: true
        }).eq('status_verifikasi', 'pending');
        setPendingCount(data?.length || 0);
      } else if (userRole === 'calon_pppk') {
        // Fetch document stats for PPPK user
        const {
          data
        } = await supabase.from('user_dokumen').select('status_verifikasi').eq('user_id', user.id);
        const stats = {
          pending: data?.filter(d => d.status_verifikasi === 'pending').length || 0,
          verified: data?.filter(d => d.status_verifikasi === 'verified').length || 0,
          rejected: data?.filter(d => d.status_verifikasi === 'rejected').length || 0
        };
        setDocStats(stats);
      }
    };
    fetchNotifications();

    // Setup realtime subscription
    const channel = supabase.channel('navbar-notifications').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_dokumen'
    }, () => {
      fetchNotifications();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userRole]);
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  return <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <FileCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">SIAP BERES</h1>
            <p className="text-xs text-muted-foreground">Sistem Informasi Administrasi PPPK - Berkas Sesuai</p>
          </div>
        </div>

        {user && <div className="flex items-center gap-2">
            {/* Notification Badge for Admin */}
            {userRole === 'admin_bkd' && pendingCount > 0 && <div className="relative">
                <Button variant="ghost" size="icon" onClick={() => navigate("/review-dokumen")}>
                  <Bell className="h-5 w-5" />
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Badge>
                </Button>
              </div>}

            {/* Notification Badge for PPPK */}
            {userRole === 'calon_pppk' && (docStats.pending > 0 || docStats.verified > 0 || docStats.rejected > 0) && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                      {docStats.pending + docStats.verified + docStats.rejected > 99 ? '99+' : docStats.pending + docStats.verified + docStats.rejected}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Status Dokumen</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-warning"></div>
                        Menunggu Review
                      </span>
                      <Badge variant="outline">{docStats.pending}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-accent"></div>
                        Terverifikasi
                      </span>
                      <Badge variant="outline">{docStats.verified}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-destructive"></div>
                        Ditolak
                      </span>
                      <Badge variant="outline">{docStats.rejected}</Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/upload-dokumen")}>
                    Lihat Semua Dokumen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {userRole === 'admin_bkd' ? 'Admin BKD' : fullName || 'Calon PPPK'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(userRole === 'admin_bkd' ? '/dashboard-admin' : '/dashboard-pppk')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>}
      </div>
    </nav>;
};