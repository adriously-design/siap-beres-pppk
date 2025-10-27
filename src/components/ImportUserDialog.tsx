import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ImportUserDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "File harus berformat .csv",
      });
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Silakan pilih file CSV terlebih dahulu",
      });
      return;
    }

    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      const users = lines.map(line => {
        const [no_peserta, nik, full_name] = line.split(',').map(s => s.trim());
        return { no_peserta, nik, full_name };
      });

      // Validate data
      const invalidUsers = users.filter(u => !u.no_peserta || !u.nik || u.nik.length !== 16 || !u.full_name);
      if (invalidUsers.length > 0) {
        toast({
          variant: "destructive",
          title: "Data tidak valid",
          description: `${invalidUsers.length} baris data tidak valid. Pastikan format: NO_PESERTA,NIK,NAMA_LENGKAP`,
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Import users one by one
      for (const user of users) {
        try {
          // Create auth user with auto-generated email
          const email = `${user.no_peserta}@pppk.local`;
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: user.nik,
            options: {
              data: {
                full_name: user.full_name,
                nik: user.nik,
                no_peserta: user.no_peserta,
              },
            },
          });

          if (authError) {
            console.error(`Error creating user ${user.no_peserta}:`, authError);
            errorCount++;
            continue;
          }

          successCount++;
        } catch (error) {
          console.error(`Error importing user ${user.no_peserta}:`, error);
          errorCount++;
        }
      }

      toast({
        title: "Import selesai",
        description: `Berhasil: ${successCount}, Gagal: ${errorCount}`,
      });

      if (successCount > 0) {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setOpen(false);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Gagal mengimport data",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start" variant="outline">
          <Upload className="h-5 w-5 mr-2" />
          Import Data User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Data Calon PPPK
          </DialogTitle>
          <DialogDescription>
            Import data user dalam format CSV. Setiap baris: NO_PESERTA,NIK,NAMA_LENGKAP
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload File CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={loading}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                File terpilih: {file.name}
              </p>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p className="font-medium">Format CSV:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Setiap baris: NO_PESERTA,NIK,NAMA_LENGKAP</li>
              <li>NIK harus 16 digit</li>
              <li>Tidak menggunakan header</li>
              <li>Pisahkan dengan koma (,)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Contoh:</strong><br/>
              001,1234567890123456,ANDI WIJAYA<br/>
              002,9876543210987654,BUDI SANTOSO
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Catatan:</strong> Password otomatis adalah NIK user
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengimport...
                </>
              ) : (
                "Import Data"
              )}
            </Button>
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              disabled={loading}
            >
              Batal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
