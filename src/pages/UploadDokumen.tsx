import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, Eye, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadDokumenDialog } from "@/components/UploadDokumenDialog";
import { useToast } from "@/hooks/use-toast";

interface Dokumen {
  id: string;
  nama_dokumen: string;
  deskripsi: string;
  format_file: string[];
  max_size_kb: number;
  is_required: boolean;
}

interface UserDokumen {
  id: string;
  dokumen_id: string;
  file_name: string;
  file_path: string;
  file_size_kb: number;
  status_verifikasi: string;
  catatan_admin?: string;
  uploaded_at: string;
  verified_at?: string;
}

export default function UploadDokumen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [dokumenList, setDokumenList] = useState<Dokumen[]>([]);
  const [userDokumen, setUserDokumen] = useState<UserDokumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDokumen, setSelectedDokumen] = useState<Dokumen | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch all required documents
      const { data: dokumen, error: dokError } = await supabase
        .from('dokumen')
        .select('*')
        .order('nama_dokumen');

      if (dokError) throw dokError;

      // Fetch user's uploaded documents
      const { data: userDocs, error: userError } = await supabase
        .from('user_dokumen')
        .select('*')
        .eq('user_id', user!.id);

      if (userError) throw userError;

      setDokumenList(dokumen || []);
      setUserDokumen(userDocs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data dokumen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserDoc = (dokumenId: string) => {
    return userDokumen.find(doc => doc.dokumen_id === dokumenId);
  };

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return <Badge variant="outline">Belum Upload</Badge>;
    }

    switch (status) {
      case 'verified':
        return <Badge className="bg-accent text-accent-foreground">Terverifikasi</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground">Menunggu Review</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="outline">Belum Upload</Badge>;
    }
  };

  const handleUpload = (dokumen: Dokumen) => {
    setSelectedDokumen(dokumen);
    setDialogOpen(true);
  };

  const handleUploadSuccess = () => {
    fetchData();
    setDialogOpen(false);
  };

  const handlePreview = async (userDoc: UserDokumen) => {
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
            dokumenId: userDoc.id,
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

  const handleDelete = async (userDoc: UserDokumen) => {
    if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) return;

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call edge function to delete from R2 and database
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-from-drive`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userDokumenId: userDoc.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      toast({
        title: "Berhasil",
        description: "Dokumen berhasil dihapus",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus dokumen",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <h1 className="text-3xl font-bold mb-2">Upload Dokumen</h1>
          <p className="text-muted-foreground">
            Unggah dan kelola dokumen persyaratan PPPK Anda
          </p>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">📋 Panduan Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✅ Pastikan file dalam format yang benar (PDF/JPG sesuai ketentuan)</p>
            <p>✅ Ukuran file tidak melebihi batas maksimal</p>
            <p>✅ File dapat dilihat dengan jelas dan tidak buram</p>
            <p>✅ Dokumen yang ditolak dapat di-upload ulang</p>
          </CardContent>
        </Card>

        {/* Documents List */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {dokumenList.map((dokumen) => {
              const userDoc = getUserDoc(dokumen.id);
              
              return (
                <Card key={dokumen.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base">{dokumen.nama_dokumen}</CardTitle>
                          {dokumen.is_required && (
                            <Badge variant="outline" className="text-xs">Wajib</Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs line-clamp-2">
                          {dokumen.deskripsi}
                        </CardDescription>
                        
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Format: {dokumen.format_file.map(f => f.toUpperCase()).join(', ')}</span>
                          <span>Max: {dokumen.max_size_kb >= 1024 ? `${dokumen.max_size_kb / 1024}MB` : `${dokumen.max_size_kb}KB`}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 ml-2">{getStatusBadge(userDoc?.status_verifikasi)}</div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-3">
                    {userDoc && (
                      <div className="mb-3 p-3 bg-muted rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{userDoc.file_name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Upload: {new Date(userDoc.uploaded_at).toLocaleDateString('id-ID')}
                            </p>
                            {userDoc.verified_at && (
                              <p className="text-xs text-muted-foreground">
                                Verifikasi: {new Date(userDoc.verified_at).toLocaleDateString('id-ID')}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreview(userDoc)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {userDoc.status_verifikasi !== 'verified' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(userDoc)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {userDoc.catatan_admin && (
                          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                            <p className="text-xs font-medium text-destructive mb-1">Catatan Admin:</p>
                            <p className="text-xs">{userDoc.catatan_admin}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <Button
                      onClick={() => handleUpload(dokumen)}
                      disabled={userDoc?.status_verifikasi === 'verified'}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {userDoc ? 'Upload Ulang' : 'Upload Dokumen'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {selectedDokumen && (
        <UploadDokumenDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          dokumen={selectedDokumen}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}