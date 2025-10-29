import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface DokumenStats {
  total: number;
  uploaded: number;
  verified: number;
  pending: number;
  rejected: number;
}

export default function DashboardPPPK() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DokumenStats>({
    total: 0,
    uploaded: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch total dokumen
      const { count: totalDokumen } = await supabase
        .from('dokumen')
        .select('*', { count: 'exact', head: true });

      // Fetch user's uploaded documents
      const { data: userDocs } = await supabase
        .from('user_dokumen')
        .select('status_verifikasi')
        .eq('user_id', user!.id);

      const uploaded = userDocs?.length || 0;
      const verified = userDocs?.filter(d => d.status_verifikasi === 'verified').length || 0;
      const pending = userDocs?.filter(d => d.status_verifikasi === 'pending').length || 0;
      const rejected = userDocs?.filter(d => d.status_verifikasi === 'rejected').length || 0;

      setStats({
        total: totalDokumen || 0,
        uploaded,
        verified,
        pending,
        rejected,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const completionPercentage = stats.total > 0 
    ? Math.round((stats.verified / stats.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Calon PPPK</h1>
          <p className="text-muted-foreground">
            Kelola dan verifikasi dokumen persyaratan PPPK Anda
          </p>
        </div>

        {/* Progress Overview */}
        <Card className="mb-8 border-primary/20">
          <CardHeader>
            <CardTitle>Status Kelengkapan Dokumen</CardTitle>
            <CardDescription>
              Progres verifikasi dokumen Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {stats.verified} dari {stats.total} dokumen terverifikasi
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {completionPercentage}%
                  </span>
                </div>
                <Progress value={completionPercentage} className="h-3" />
                <p className="text-sm text-muted-foreground mt-3">
                  {completionPercentage === 100 
                    ? "🎉 Selamat! Semua dokumen telah terverifikasi" 
                    : "Upload dan verifikasi dokumen untuk melanjutkan"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Dokumen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.total}</div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Terverifikasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-accent">{stats.verified}</div>
                <CheckCircle2 className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Menunggu Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-warning">{stats.pending}</div>
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Perlu Diperbaiki
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-destructive">{stats.rejected}</div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Upload Dokumen</CardTitle>
                  <CardDescription>
                    Unggah dan verifikasi dokumen persyaratan
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/upload-dokumen')}>
                Kelola Dokumen
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle>E-Bimtek & Panduan</CardTitle>
                  <CardDescription>
                    Pelajari panduan upload dokumen
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => navigate('/e-bimtek')}>
                Lihat Panduan
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Info */}
        <Card className="mt-6 bg-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-lg">💡 Tips Self-Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✅ Pastikan semua dokumen di-scan dengan jelas dan berwarna</p>
            <p>✅ Periksa ukuran file tidak melebihi batas maksimal</p>
            <p>✅ Verifikasi checklist sebelum upload untuk menghindari penolakan</p>
            <p>✅ Gunakan E-Bimtek untuk panduan detail setiap dokumen</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
