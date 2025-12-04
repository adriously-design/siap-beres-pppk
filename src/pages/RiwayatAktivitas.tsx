import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, XCircle, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ActivityLog {
  id: string;
  document_id: string;
  document_name: string;
  user_name: string;
  admin_name: string;
  action: string;
  timestamp: string;
  catatan: string;
}

export default function RiwayatAktivitas() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      // 1. Fetch all verified/rejected documents
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
          dokumen:dokumen_id (
            nama_dokumen
          )
        `)
        .in('status_verifikasi', ['verified', 'rejected']);

      if (docsError) {
        logger.error('Error fetching documents:', docsError);
        setLoading(false);
        return;
      }

      if (!userDocs || userDocs.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Collect all User IDs (PPPK) and Admin IDs
      const userIds = new Set<string>();
      const adminIds = new Set<string>();
      const tempLogs: any[] = [];

      userDocs.forEach(doc => {
        if (doc.user_id) userIds.add(doc.user_id);

        const history = doc.catatan_history as any[];
        let hasHistoryLog = false;
        // Use document name from relation, fallback to file name if missing
        const docName = (doc.dokumen as any)?.nama_dokumen || doc.file_name;

        if (Array.isArray(history) && history.length > 0) {
          history.forEach((entry, index) => {
            if (entry.type === 'admin') {
              hasHistoryLog = true;
              if (entry.admin_id) {
                adminIds.add(entry.admin_id);
              }
              tempLogs.push({
                document_id: doc.id,
                document_name: docName,
                user_id: doc.user_id,
                action: entry.action || doc.status_verifikasi,
                timestamp: entry.timestamp || doc.verified_at || new Date().toISOString(),
                catatan: entry.message,
                admin_id: entry.admin_id,
                unique_key: `${doc.id}-${index}`
              });
            }
          });
        }

        // Fallback for legacy data
        if (!hasHistoryLog && (doc.status_verifikasi === 'verified' || doc.status_verifikasi === 'rejected')) {
          tempLogs.push({
            document_id: doc.id,
            document_name: docName,
            user_id: doc.user_id,
            action: doc.status_verifikasi,
            timestamp: doc.verified_at || new Date().toISOString(),
            catatan: doc.catatan_admin || '',
            admin_id: null,
            unique_key: `${doc.id}-legacy`
          });
        }
      });

      // 3. Fetch All Profiles (Admins + Users)
      const allProfileIds = new Set([...userIds, ...adminIds]);
      const profilesMap: Record<string, string> = {};

      if (allProfileIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(allProfileIds));

        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = p.full_name;
          });
        }
      }

      // 4. Map logs with names
      const finalLogs: ActivityLog[] = tempLogs.map(log => ({
        id: log.unique_key,
        document_id: log.document_id,
        document_name: log.document_name,
        user_name: profilesMap[log.user_id] || 'Unknown User',
        admin_name: profilesMap[log.admin_id] || 'Admin',
        action: log.action,
        timestamp: log.timestamp,
        catatan: log.catatan
      }));

      // 5. Sort by timestamp descending
      finalLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(finalLogs);
    } catch (error) {
      logger.error('Error fetching activity logs:', error);
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
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'verified':
        return <Badge className="bg-green-600">Diverifikasi</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge className="bg-blue-600">Direview</Badge>;
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(activities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedActivities = activities.slice(startIndex, endIndex);

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
          <h1 className="text-2xl font-bold mb-1">Riwayat Aktivitas Verifikasi</h1>
          <p className="text-sm text-muted-foreground">
            Log aktivitas verifikasi dokumen oleh admin
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Belum ada aktivitas verifikasi yang tercatat
              </div>
            ) : (
              <>
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                      <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[200px]">
                          Waktu
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[200px]">
                          Nama Admin
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                          Aktivitas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {paginatedActivities.map((activity) => (
                        <tr
                          key={activity.id}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                        >
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {format(new Date(activity.timestamp), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {activity.admin_name || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{activity.user_name}</span>
                                <span className="text-muted-foreground">-</span>
                                <span>{activity.document_name}</span>
                                {getActionBadge(activity.action)}
                              </div>
                              {activity.catatan && (
                                <p className="text-xs text-muted-foreground">
                                  Catatan: {activity.catatan}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Menampilkan {startIndex + 1}-{Math.min(endIndex, activities.length)} dari {activities.length} aktivitas
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Sebelumnya
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-9"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
