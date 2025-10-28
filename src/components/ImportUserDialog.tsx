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
      const lines = text.trim().split('\n').filter(line => line.trim().length > 0);
      
      const users = lines.map((line, index) => {
        // Remove dangerous CSV formula characters
        const safeLine = line.replace(/^[=+\-@]/, '');
        const parts = safeLine.split(',').map(s => s.trim());
        
        if (parts.length !== 3) {
          throw new Error(`Baris ${index + 1}: Format tidak valid`);
        }
        
        const [no_peserta, nik, full_name] = parts;
        
        // Validate NIK is numeric
        if (!/^\d{16}$/.test(nik)) {
          throw new Error(`Baris ${index + 1}: NIK harus 16 digit angka`);
        }
        
        // Sanitize name - remove dangerous characters
        const sanitizedName = full_name
          .replace(/[<>"']/g, '')
          .replace(/[;]/g, '')
          .trim();
        
        if (!no_peserta || !sanitizedName) {
          throw new Error(`Baris ${index + 1}: Data tidak lengkap`);
        }
        
        return { no_peserta, nik, full_name: sanitizedName };
      });

      // Call edge function for bulk create with server-side validation
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { 
          action: 'bulk_create',
          userData: users
        },
      });

      if (error) throw error;

      const { results, summary } = data;
      
      // Show detailed results
      const passwordList = results
        .filter((r: any) => r.success)
        .map((r: any) => `${r.no_peserta}: ${r.password}`)
        .join('\n');

      if (summary.successCount > 0) {
        toast({
          title: "Import selesai",
          description: `Berhasil: ${summary.successCount}, Gagal: ${summary.errorCount}`,
        });

        // Show passwords in a downloadable format
        if (passwordList) {
          const blob = new Blob([`Password untuk user yang berhasil dibuat:\n\n${passwordList}\n\nHARAP SIMPAN FILE INI DENGAN AMAN!`], 
            { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `passwords_${new Date().toISOString().split('T')[0]}.txt`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          toast({
            title: "Password berhasil disimpan",
            description: "File password telah diunduh. Berikan password kepada user yang bersangkutan.",
          });
        }

        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Import gagal",
          description: "Tidak ada user yang berhasil dibuat. Periksa format file CSV.",
        });
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
              <strong>Catatan:</strong> Password akan digenerate secara otomatis dan akan diunduh setelah import berhasil
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
