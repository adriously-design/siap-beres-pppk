import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Eye, Search, Filter } from "lucide-react";

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
  const [filteredUsers, setFilteredUsers] = useState<PPPKUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchUsersWithDocuments();
  }, []);

  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(query) ||
          user.no_peserta.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => {
        const pendingCount = user.uploaded_count - user.verified_count - user.rejected_count;
        
        switch (statusFilter) {
          case "belum_upload":
            return user.uploaded_count === 0;
          case "pending":
            return pendingCount > 0 && user.rejected_count === 0;
          case "ada_ditolak":
            return user.rejected_count > 0;
          case "selesai":
            return user.uploaded_count > 0 && user.verified_count === user.uploaded_count;
          default:
            return true;
        }
      });
    }

    setFilteredUsers(filtered);
  }, [searchQuery, statusFilter, users]);

  const fetchUsersWithDocuments = async () => {
    try {
      const { count: docsCount } = await supabase
        .from('dokumen')
        .select('*', { count: 'exact', head: true })
        .eq('is_required', true);

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'calon_pppk');

      if (!userRoles || userRoles.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = userRoles.map(ur => ur.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, no_peserta')
        .in('id', userIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

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
      setFilteredUsers(usersWithStats);
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
    if (uploaded === 0) return <Badge variant="outline" className="text-xs">Belum Upload</Badge>;
    if (rejected > 0) return <Badge variant="destructive" className="text-xs">Ada Ditolak</Badge>;
    if (verified === uploaded) return <Badge className="bg-green-600 text-xs">Selesai</Badge>;
    return <Badge className="bg-yellow-600 text-xs">Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Review Dokumen PPPK</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Daftar calon PPPK dan status dokumen mereka
          </p>
          
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau no peserta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="belum_upload">Belum Upload</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="ada_ditolak">Ada Ditolak</SelectItem>
                <SelectItem value="selesai">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {searchQuery ? "Tidak ada hasil yang ditemukan" : "Belum ada calon PPPK terdaftar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{user.full_name}</h3>
                        {getStatusBadge(user.verified_count, user.rejected_count, user.uploaded_count)}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        No Peserta: {user.no_peserta}
                      </p>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {user.uploaded_count}/{user.total_documents}
                            </span>
                          </div>
                          <Progress 
                            value={getProgressPercentage(user.uploaded_count, user.total_documents)} 
                            className="h-1.5"
                          />
                        </div>
                        
                        <div className="flex gap-6 text-xs">
                          <div className="text-center">
                            <p className="font-bold text-green-600">{user.verified_count}</p>
                            <p className="text-muted-foreground">Verified</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-yellow-600">
                              {user.uploaded_count - user.verified_count - user.rejected_count}
                            </p>
                            <p className="text-muted-foreground">Pending</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-red-600">{user.rejected_count}</p>
                            <p className="text-muted-foreground">Rejected</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate(`/review-dokumen/${user.id}`)}
                      size="sm"
                      className="shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Review
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
