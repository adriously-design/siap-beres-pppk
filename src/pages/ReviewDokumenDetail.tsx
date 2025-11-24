import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { MessageHistoryDialog } from "@/components/MessageHistoryDialog";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Eye, MessageSquare } from "lucide-react";

interface UserProfile {
  full_name: string;
  no_peserta: string;
}

interface DokumenItem {
  id: string;
  nama_dokumen: string;
  deskripsi: string;
}

interface UserDokumenItem {
  id: string;
  dokumen_id: string;
  file_name: string;
  file_path: string;
  status_verifikasi: string;
  catatan_admin: string | null;
  catatan_user: string | null;
  catatan_history: any[];
  uploaded_at: string;
  dokumen: DokumenItem;
}

export default function ReviewDokumenDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<UserDokumenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [batchNote, setBatchNote] = useState("");

  useEffect(() => {
    if (userId) {
      fetchUserDocuments();
    }
  }, [userId]);

  const fetchUserDocuments = async () => {
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, no_peserta')
        .eq('id', userId)
        .single();

      setProfile(profileData);

      // Fetch user documents with dokumen details
      const { data: docsData } = await supabase
        .from('user_dokumen')
        .select(`
          id,
          dokumen_id,
          file_name,
          file_path,
          status_verifikasi,
          catatan_admin,
          catatan_user,
          catatan_history,
          uploaded_at,
          dokumen:dokumen_id (
            id,
            nama_dokumen,
            deskripsi
          )
        `)
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

      if (docsData) {
        setDocuments(docsData as any);
        
        // Initialize admin notes
        const notes: Record<string, string> = {};
        docsData.forEach((doc: any) => {
          notes[doc.id] = doc.catatan_admin || '';
        });
        setAdminNotes(notes);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data dokumen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (docId: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call edge function to get presigned URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-presigned-url-r2`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dokumenId: docId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get presigned URL');
      }

      const { presignedUrl } = await response.json();
      window.open(presignedUrl, '_blank');
    } catch (error) {
      console.error('Error previewing file:', error);
      toast({
        title: "Error",
        description: "Gagal membuka file",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (docId: string, status: 'verified' | 'rejected') => {
    setUpdating(docId);
    try {
      const currentDoc = documents.find(d => d.id === docId);
      const currentHistory = currentDoc?.catatan_history || [];
      
      // Add new message to history if there's an admin note
      const newHistory = adminNotes[docId]?.trim() 
        ? [
            ...currentHistory,
            {
              type: 'admin',
              message: adminNotes[docId],
              timestamp: new Date().toISOString()
            }
          ]
        : currentHistory;

      const { error } = await supabase
        .from('user_dokumen')
        .update({
          status_verifikasi: status,
          catatan_admin: adminNotes[docId] || null,
          catatan_history: newHistory,
          verified_at: status === 'verified' ? new Date().toISOString() : null,
        })
        .eq('id', docId);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `Dokumen berhasil ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`,
      });

      fetchUserDocuments();
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error",
        description: "Gagal mengupdate status dokumen",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleViewHistory = (history: any[]) => {
    setSelectedHistory(history || []);
    setHistoryDialogOpen(true);
  };

  const toggleDocSelection = (docId: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(d => d.id)));
    }
  };

  const handleBatchUpdate = async (status: 'verified' | 'rejected') => {
    if (selectedDocs.size === 0) {
      toast({
        title: "Error",
        description: "Pilih minimal satu dokumen",
        variant: "destructive",
      });
      return;
    }

    setUpdating('batch');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const updatePromises = Array.from(selectedDocs).map(async (docId) => {
        const doc = documents.find(d => d.id === docId);
        if (!doc) return;

        const existingHistory = Array.isArray(doc.catatan_history) ? doc.catatan_history : [];
        const newHistory = [
          ...existingHistory,
          {
            type: 'admin',
            message: batchNote || `Batch ${status === 'verified' ? 'verifikasi' : 'penolakan'}`,
            timestamp: new Date().toISOString(),
            admin_id: user.id,
            action: status
          }
        ];

        return supabase
          .from('user_dokumen')
          .update({
            status_verifikasi: status,
            catatan_admin: batchNote || `Batch ${status === 'verified' ? 'verifikasi' : 'penolakan'}`,
            verified_at: status === 'verified' ? new Date().toISOString() : null,
            catatan_history: newHistory
          })
          .eq('id', docId);
      });

      await Promise.all(updatePromises);

      toast({
        title: "Berhasil",
        description: `${selectedDocs.size} dokumen berhasil ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`,
      });
      
      setSelectedDocs(new Set());
      setBatchNote("");
      fetchUserDocuments();
    } catch (error) {
      console.error('Error updating documents:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui dokumen",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-600">Terverifikasi</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge className="bg-yellow-600">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </main>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold mb-1">Review Dokumen</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.full_name} - No Peserta: {profile?.no_peserta}
          </p>
        </div>

        {documents.length > 0 && (
          <Card className="mb-4 bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedDocs.size === documents.length && documents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm font-medium">
                      {selectedDocs.size > 0 ? `${selectedDocs.size} dipilih` : 'Pilih Semua'}
                    </span>
                  </div>
                  
                  {selectedDocs.size > 0 && (
                    <Textarea
                      placeholder="Catatan untuk batch action (opsional)"
                      value={batchNote}
                      onChange={(e) => setBatchNote(e.target.value)}
                      className="h-9 min-h-9 w-64"
                    />
                  )}
                </div>

                {selectedDocs.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleBatchUpdate('verified')}
                      disabled={updating === 'batch'}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Verifikasi {selectedDocs.size} Dokumen
                    </Button>
                    <Button
                      onClick={() => handleBatchUpdate('rejected')}
                      disabled={updating === 'batch'}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Tolak {selectedDocs.size} Dokumen
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {documents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Belum ada dokumen yang diupload</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Checkbox
                          checked={selectedDocs.has(doc.id)}
                          onCheckedChange={() => toggleDocSelection(doc.id)}
                        />
                        <CardTitle className="text-lg">{doc.dokumen.nama_dokumen}</CardTitle>
                        {getStatusBadge(doc.status_verifikasi)}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{doc.dokumen.deskripsi}</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        Upload: {new Date(doc.uploaded_at).toLocaleDateString('id-ID')} • {doc.file_name}
                      </p>
                    </div>
                    {doc.catatan_history && doc.catatan_history.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewHistory(doc.catatan_history)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        <span className="text-xs">Riwayat ({doc.catatan_history.length})</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doc.catatan_user && (
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <Label className="text-xs font-medium text-blue-900 dark:text-blue-100">
                        Catatan dari PPPK:
                      </Label>
                      <p className="text-xs mt-1 text-blue-800 dark:text-blue-200">
                        {doc.catatan_user}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor={`notes-${doc.id}`} className="text-sm">Catatan Admin</Label>
                    <Textarea
                      id={`notes-${doc.id}`}
                      value={adminNotes[doc.id] || ''}
                      onChange={(e) => setAdminNotes(prev => ({
                        ...prev,
                        [doc.id]: e.target.value
                      }))}
                      placeholder="Tambahkan catatan atau feedback..."
                      className="min-h-[80px] text-sm"
                      disabled={updating === doc.id}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePreview(doc.id)}
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Lihat
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(doc.id, 'verified')}
                      disabled={updating === doc.id || doc.status_verifikasi === 'verified'}
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      {updating === doc.id ? 'Proses...' : 'Verifikasi'}
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(doc.id, 'rejected')}
                      disabled={updating === doc.id || doc.status_verifikasi === 'rejected'}
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      {updating === doc.id ? 'Proses...' : 'Tolak'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      <MessageHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        history={selectedHistory}
        userName={profile?.full_name || ''}
      />
    </div>
  );
}
