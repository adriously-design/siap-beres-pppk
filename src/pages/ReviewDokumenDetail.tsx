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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Eye } from "lucide-react";

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

  const handlePreview = async (filePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('dokumen-pppk')
        .createSignedUrl(filePath, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
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
      const { error } = await supabase
        .from('user_dokumen')
        .update({
          status_verifikasi: status,
          catatan_admin: adminNotes[docId] || null,
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
      
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/review-dokumen')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Daftar PPPK
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Review Dokumen</h1>
          <p className="text-lg text-muted-foreground">
            {profile?.full_name} - No Peserta: {profile?.no_peserta}
          </p>
        </div>

        {documents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Belum ada dokumen yang diupload</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">
                        {doc.dokumen.nama_dokumen}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mb-2">
                        {doc.dokumen.deskripsi}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(doc.status_verifikasi)}
                        <span className="text-xs text-muted-foreground">
                          Upload: {new Date(doc.uploaded_at).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{doc.file_name}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Catatan User */}
                  {doc.catatan_user && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <Label className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Catatan dari PPPK:
                      </Label>
                      <p className="text-sm mt-1 text-blue-800 dark:text-blue-200">
                        {doc.catatan_user}
                      </p>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${doc.id}`}>Catatan Admin (Feedback)</Label>
                    <Textarea
                      id={`notes-${doc.id}`}
                      value={adminNotes[doc.id] || ''}
                      onChange={(e) => setAdminNotes(prev => ({
                        ...prev,
                        [doc.id]: e.target.value
                      }))}
                      placeholder="Tambahkan catatan atau feedback untuk dokumen ini..."
                      className="min-h-[100px]"
                      disabled={updating === doc.id}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePreview(doc.file_path)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Lihat File
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(doc.id, 'verified')}
                      disabled={updating === doc.id || doc.status_verifikasi === 'verified'}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {updating === doc.id ? 'Memproses...' : 'Verifikasi'}
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(doc.id, 'rejected')}
                      disabled={updating === doc.id || doc.status_verifikasi === 'rejected'}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {updating === doc.id ? 'Memproses...' : 'Tolak'}
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
