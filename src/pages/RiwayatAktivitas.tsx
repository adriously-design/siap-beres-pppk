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
      // Get user documents with history
      const { data: userDocs, error: docsError } = await supabase
        .from('user_dokumen')
        .select(`
          id,
          file_name,
          catatan_history,
          catatan_admin,
          user_id,
          status_verifikasi,
          verified_at,
          profiles!user_dokumen_user_id_fkey(full_name)
        `)
        .in('status_verifikasi', ['verified', 'rejected'])
        .not('verified_at', 'is', null)
        .order('verified_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching documents:', docsError);
        setLoading(false);
        return;
      }

      if (!userDocs || userDocs.length === 0) {
        setLoading(false);
        return;
      }

      const logs: ActivityLog[] = [];

      // Build activity logs from verified documents
      for (const doc of userDocs) {
        // Cari catatan admin terakhir dari history
        const history = doc.catatan_history as any[];
        let adminMessage = doc.catatan_admin || '';
        
        if (Array.isArray(history) && history.length > 0) {
          // Cari pesan admin terakhir
          const adminMessages = history.filter((entry: any) => entry.type === 'admin');
          if (adminMessages.length > 0) {
            const lastAdminMessage = adminMessages[adminMessages.length - 1];
            adminMessage = lastAdminMessage.message || adminMessage;
          }
        }

        logs.push({
          id: doc.id,
          document_name: doc.file_name,
          user_name: (doc.profiles as any)?.full_name || 'Unknown',
          action: doc.status_verifikasi,
          timestamp: doc.verified_at || new Date().toISOString(),
          catatan: adminMessage,
        });
      }

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
                          <span className="font-medium">Waktu:</span> {format(new Date(activity.timestamp), "dd MMMM yyyy 'pukul' HH:mm", { locale: idLocale })}
                        </p>
                        {activity.catatan && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Catatan Admin:</span> {activity.catatan}
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
