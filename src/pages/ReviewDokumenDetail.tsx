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
import { ArrowLeft, FileText } from "lucide-react";
import { BatchActionToolbar } from "@/components/review-dokumen/BatchActionToolbar";
import { DocumentCard } from "@/components/review-dokumen/DocumentCard";

import { UserProfile, UserDokumenItem, VerificationStatus } from "@/types";

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

  const handleUpdateStatus = async (docId: string, status: VerificationStatus) => {
    setUpdating(docId);
    try {
      const currentDoc = documents.find(d => d.id === docId);
      const currentHistory = currentDoc?.catatan_history || [];

      const { data: { user } } = await supabase.auth.getUser();

      // Add new message to history if there's an admin note
      const newHistory = adminNotes[docId]?.trim()
        ? [
          ...currentHistory,
          {
            type: 'admin',
            message: adminNotes[docId],
            timestamp: new Date().toISOString(),
            admin_id: user?.id,
            action: status
          }
        ]
        : currentHistory;

      const { error } = await supabase
        .from('user_dokumen')
        .update({
          status_verifikasi: status,
          catatan_admin: adminNotes[docId] || null,
          catatan_history: newHistory as any,
          verified_at: new Date().toISOString(), // Always set timestamp
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

  const handleBatchUpdate = async (status: VerificationStatus) => {
    if (status === 'pending') return; // Should not happen from UI

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
            verified_at: new Date().toISOString(), // Always set timestamp
            catatan_history: newHistory as any
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
          <BatchActionToolbar
            selectedCount={selectedDocs.size}
            totalCount={documents.length}
            onSelectAll={toggleSelectAll}
            batchNote={batchNote}
            setBatchNote={setBatchNote}
            onBatchUpdate={handleBatchUpdate}
            updating={updating === 'batch'}
          />
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
              <DocumentCard
                key={doc.id}
                doc={doc}
                selected={selectedDocs.has(doc.id)}
                onSelect={() => toggleDocSelection(doc.id)}
                adminNote={adminNotes[doc.id] || ''}
                onNoteChange={(note) => setAdminNotes(prev => ({ ...prev, [doc.id]: note }))}
                onPreview={() => handlePreview(doc.id)}
                onUpdateStatus={(status) => handleUpdateStatus(doc.id, status)}
                onViewHistory={() => handleViewHistory(doc.catatan_history)}
                updating={updating === doc.id}
                isVerified={doc.status_verifikasi === 'verified'}
                isRejected={doc.status_verifikasi === 'rejected'}
              />
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
