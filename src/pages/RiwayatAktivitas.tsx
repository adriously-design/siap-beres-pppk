import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ActivityLog {
  id: string;
  document_name: string;
  user_name: string;
  admin_name: string;
  admin_email: string;
  action: string;
  timestamp: string;
  catatan: string;
}

export default function RiwayatAktivitas() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      // First, get user documents with history
      const { data: userDocs } = await supabase
        .from('user_dokumen')
        .select(`
          id,
          file_name,
          catatan_history,
          user_id,
          status_verifikasi,
          verified_at,
          profiles!user_dokumen_user_id_fkey(full_name)
        `)
        .in('status_verifikasi', ['verified', 'rejected'])
        .not('verified_at', 'is', null)
        .order('verified_at', { ascending: false });

      if (!userDocs) {
        setLoading(false);
        return;
      }

      const logs: ActivityLog[] = [];

      // Get all unique admin IDs first
      const adminIds = new Set<string>();
      for (const doc of userDocs) {
        const history = doc.catatan_history as any[];
        if (Array.isArray(history)) {
          for (const entry of history) {
            if (entry.admin_id) {
              adminIds.add(entry.admin_id);
            }
          }
        }
      }

      // Fetch all admin emails in one query using edge function
      const adminEmailMap = new Map<string, string>();
      
      for (const adminId of adminIds) {
        try {
          const { data: adminData, error } = await supabase.functions.invoke('admin-user-management', {
            body: { 
              action: 'get_admin_email',
              userId: adminId
            },
          });

          if (!error && adminData?.email) {
            adminEmailMap.set(adminId, adminData.email);
          }
        } catch (err) {
          console.error('Error fetching admin email:', err);
        }
      }

      // Fetch admin profiles
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(adminIds));

      const adminProfileMap = new Map(adminProfiles?.map(p => [p.id, p.full_name]) || []);

      // Build activity logs
      for (const doc of userDocs) {
        const history = doc.catatan_history as any[];
        if (Array.isArray(history)) {
          for (const entry of history) {
            if (entry.admin_id && (entry.action === 'verified' || entry.action === 'rejected')) {
              logs.push({
                id: `${doc.id}-${entry.timestamp}`,
                document_name: doc.file_name,
                user_name: (doc.profiles as any)?.full_name || 'Unknown',
                admin_name: adminProfileMap.get(entry.admin_id) || 'Admin',
                admin_email: adminEmailMap.get(entry.admin_id) || 'Email tidak tersedia',
                action: entry.action,
                timestamp: entry.timestamp,
                catatan: entry.catatan || '',
              });
            }
          }
        }
      }

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'verified':
        return <Badge className="bg-green-600">Diverifikasi</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge className="bg-yellow-600">Pending</Badge>;
    }
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
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Riwayat Aktivitas Verifikasi</CardTitle>
            <p className="text-sm text-muted-foreground">
              Semua aksi verifikasi dokumen dari admin
            </p>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Belum ada aktivitas verifikasi
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Card key={activity.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getActionIcon(activity.action)}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{activity.document_name}</h3>
                            {getActionBadge(activity.action)}
                          </div>
                        </div>
                      
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Pengguna:</span> {activity.user_name}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Diverifikasi oleh:</span> {activity.admin_name}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Email Admin:</span> {activity.admin_email}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Waktu:</span> {format(new Date(activity.timestamp), "dd MMMM yyyy 'pukul' HH:mm", { locale: idLocale })}
                        </p>
                        {activity.catatan && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Catatan:</span> {activity.catatan}
                          </p>
                        )}
                      </div>
                    </div>
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
