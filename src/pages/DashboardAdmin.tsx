import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, CheckCircle2, Clock, AlertCircle, BookOpen, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  pendingReviews: number;
  verifiedDocs: number;
  rejectedDocs: number;
}

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalDocuments: 0,
    pendingReviews: 0,
    verifiedDocs: 0,
    rejectedDocs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch total active users (Calon PPPK only) - join with profiles to ensure user still exists
      const { data: activeUsers } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id)')
        .eq('role', 'calon_pppk');

      // Fetch document stats - only documents from existing users
      const { data: allDocs } = await supabase
        .from('user_dokumen')
        .select('status_verifikasi, profiles!inner(id)')
        .order('uploaded_at', { ascending: false });

      const totalDocuments = allDocs?.length || 0;
      const pendingReviews = allDocs?.filter(d => d.status_verifikasi === 'pending').length || 0;
      const verifiedDocs = allDocs?.filter(d => d.status_verifikasi === 'verified').length || 0;
      const rejectedDocs = allDocs?.filter(d => d.status_verifikasi === 'rejected').length || 0;

      setStats({
        totalUsers: activeUsers?.length || 0,
        totalDocuments,
        pendingReviews,
        verifiedDocs,
        rejectedDocs,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Admin BKD</h1>
          <p className="text-muted-foreground">
            Monitoring dan manajemen verifikasi dokumen PPPK
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Calon PPPK
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">{stats.totalUsers}</div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Dokumen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">{stats.totalDocuments}</div>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Menunggu Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-warning">{stats.pendingReviews}</div>
                  <Clock className="h-8 w-8 text-warning" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Terverifikasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-accent">{stats.verifiedDocs}</div>
                  <CheckCircle2 className="h-8 w-8 text-accent" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ditolak
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-destructive">{stats.rejectedDocs}</div>
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate("/review-dokumen")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Review Dokumen
              </CardTitle>
              <CardDescription>
                Verifikasi dokumen yang menunggu review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {stats.pendingReviews} Dokumen
              </Badge>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/manajemen-pengguna")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Manajemen Pengguna
              </CardTitle>
              <CardDescription>
                Kelola dan import akun Calon PPPK
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="outline" className="text-lg px-4 py-2">
                {stats.totalUsers} Pengguna
              </Badge>
              <Button variant="outline" className="w-full" onClick={(e) => {
                e.stopPropagation();
                navigate("/manajemen-pengguna");
              }}>
                Lihat Semua
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/kelola-e-bimtek")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-accent" />
                Kelola E-Bimtek
              </CardTitle>
              <CardDescription>
                Kelola konten e-bimtek untuk calon PPPK
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Kelola Konten
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">📊 Ringkasan Sistem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• {stats.totalUsers} Calon PPPK terdaftar dalam sistem</p>
            <p>• {stats.totalDocuments} Total dokumen telah diupload</p>
            <p>• {stats.pendingReviews} Dokumen menunggu verifikasi Anda</p>
            <p>• Tingkat verifikasi: {stats.totalDocuments > 0 ? Math.round((stats.verifiedDocs / stats.totalDocuments) * 100) : 0}%</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
