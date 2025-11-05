import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X } from "lucide-react";

interface Dokumen {
  id: string;
  nama_dokumen: string;
  deskripsi: string;
  format_file: string[];
  max_size_kb: number;
  is_required: boolean;
}

interface UploadDokumenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dokumen: Dokumen;
  onSuccess: () => void;
}

export function UploadDokumenDialog({
  open,
  onOpenChange,
  dokumen,
  onSuccess,
}: UploadDokumenDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userNote, setUserNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !dokumen.format_file.includes(fileExt)) {
      toast({
        title: "Format File Tidak Valid",
        description: `File harus berformat: ${dokumen.format_file.map(f => f.toUpperCase()).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > dokumen.max_size_kb) {
      const maxSizeDisplay = dokumen.max_size_kb >= 1024 
        ? `${dokumen.max_size_kb / 1024}MB` 
        : `${dokumen.max_size_kb}KB`;
      toast({
        title: "Ukuran File Terlalu Besar",
        description: `Ukuran file maksimal: ${maxSizeDisplay}`,
        variant: "destructive",
      });
      return;
    }

    // Sanitize filename
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');

    setSelectedFile(new File([file], sanitizedName, { type: file.type }));
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileBase64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const fileBase64 = await fileBase64Promise;
      setUploadProgress(25);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call edge function to upload to Google Drive
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-to-drive`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileBase64: fileBase64,
            mimeType: selectedFile.type || 'application/octet-stream',
            dokumenId: dokumen.id,
            fileSizeKb: Math.round(selectedFile.size / 1024),
            userNote: userNote || undefined,
          }),
        }
      );

      setUploadProgress(75);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      await response.json();
      setUploadProgress(100);

      toast({
        title: "Berhasil",
        description: "Dokumen berhasil diupload dan menunggu verifikasi",
      });

      onSuccess();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Gagal mengupload dokumen",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setSelectedFile(null);
      setUserNote('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {dokumen.nama_dokumen}</DialogTitle>
          <DialogDescription>{dokumen.deskripsi}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Requirements */}
          <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
            <p className="font-medium">Persyaratan:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Format: {dokumen.format_file.map(f => f.toUpperCase()).join(', ')}</li>
              <li>
                Ukuran maksimal: {dokumen.max_size_kb >= 1024 
                  ? `${dokumen.max_size_kb / 1024}MB` 
                  : `${dokumen.max_size_kb}KB`}
              </li>
              <li>File harus jelas dan dapat dibaca</li>
            </ul>
          </div>

          {/* File Input */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={dokumen.format_file.map(f => `.${f}`).join(',')}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            
            {!selectedFile ? (
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Klik untuk memilih file
                </span>
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* User Note */}
          <div className="space-y-2">
            <Label htmlFor="user-note">Catatan (Opsional)</Label>
            <Textarea
              id="user-note"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="Tambahkan catatan jika ada yang perlu dijelaskan..."
              className="min-h-[80px]"
              disabled={uploading}
            />
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                Mengupload... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Mengupload...' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}