import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Eye } from "lucide-react";

interface PPPKUser {
  id: string;
  full_name: string;
  no_peserta: string;
  uploaded_count: number;
  verified_count: number;
  rejected_count: number;
  total_documents: number;
}

export default function ReviewDokumen() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PPPKUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDocs, setTotalDocs] = useState(0);

  useEffect(() => {
    fetchUsersWithDocuments();
  }, []);

  const fetchUsersWithDocuments = async () => {
    try {
      // Get total required documents
      const { count: docsCount } = await supabase
        .from('dokumen')
        .select('*', { count: 'exact', head: true })
        .eq('is_required', true);

      setTotalDocs(docsCount || 0);

      // Get all calon_pppk users
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'calon_pppk');

      if (!userRoles || userRoles.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = userRoles.map(ur => ur.user_id);

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, no_peserta')
        .in('id', userIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Get document stats for each user
      const usersWithStats = await Promise.all(
        profiles.map(async (profile) => {
          const { data: docs } = await supabase
            .from('user_dokumen')
            .select('status_verifikasi')
            .eq('user_id', profile.id);

          const uploaded_count = docs?.length || 0;
          const verified_count = docs?.filter(d => d.status_verifikasi === 'verified').length || 0;
          const rejected_count = docs?.filter(d => d.status_verifikasi === 'rejected').length || 0;

          return {
            id: profile.id,
            full_name: profile.full_name,
            no_peserta: profile.no_peserta || '-',
            uploaded_count,
            verified_count,
            rejected_count,
            total_documents: docsCount || 0,
          };
        })
      );

      setUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (uploaded: number, total: number) => {
    return total > 0 ? Math.round((uploaded / total) * 100) : 0;
  };

  const getStatusBadge = (verified: number, rejected: number, uploaded: number) => {
    if (uploaded === 0) return <Badge variant="outline">Belum Upload</Badge>;
    if (rejected > 0) return <Badge variant="destructive">Ada Ditolak</Badge>;
    if (verified === uploaded) return <Badge className="bg-green-600">Selesai</Badge>;
    return <Badge className="bg-yellow-600">Sedang Review</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard-admin')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">Review Dokumen PPPK</h1>
          <p className="text-muted-foreground">
            Daftar calon PPPK dan status dokumen mereka
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Belum ada calon PPPK terdaftar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{user.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        No Peserta: {user.no_peserta}
                      </p>
                    </div>
                    {getStatusBadge(user.verified_count, user.rejected_count, user.uploaded_count)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress Upload</span>
                        <span className="font-medium">
                          {user.uploaded_count} / {user.total_documents} dokumen
                        </span>
                      </div>
                      <Progress 
                        value={getProgressPercentage(user.uploaded_count, user.total_documents)} 
                        className="h-2"
                      />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{user.verified_count}</p>
                        <p className="text-xs text-muted-foreground">Terverifikasi</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                          {user.uploaded_count - user.verified_count - user.rejected_count}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{user.rejected_count}</p>
                        <p className="text-xs text-muted-foreground">Ditolak</p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={() => navigate(`/review-dokumen/${user.id}`)}
                      className="w-full mt-4"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Lihat & Review Dokumen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
