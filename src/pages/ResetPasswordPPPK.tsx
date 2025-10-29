import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const verifySchema = z.object({
  no_peserta: z.string().min(1, "No Peserta harus diisi").max(50, "No Peserta terlalu panjang"),
  nik: z.string().regex(/^\d{16}$/, "NIK harus 16 digit angka"),
});

const passwordSchema = z.object({
  new_password: z.string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Password harus mengandung huruf besar")
    .regex(/[a-z]/, "Password harus mengandung huruf kecil")
    .regex(/[0-9]/, "Password harus mengandung angka"),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Password tidak cocok",
  path: ["confirm_password"],
});

const ResetPasswordPPPK = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [verifyData, setVerifyData] = useState({
    no_peserta: "",
    nik: "",
  });
  const [passwordData, setPasswordData] = useState({
    new_password: "",
    confirm_password: "",
  });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = verifySchema.parse(verifyData);
      
      // Verify via edge function (will check both no_peserta and nik)
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          no_peserta: validated.no_peserta,
          nik: validated.nik,
          new_password: 'verify-only', // Dummy password for verification
        }
      });

      // If we get 404, it means user not found or credentials don't match
      if (error && error.message.includes('No Peserta atau NIK tidak sesuai')) {
        throw new Error('No Peserta atau NIK tidak sesuai');
      }

      // If we reach here, verification successful
      setStep('reset');
      toast({
        title: "Verifikasi Berhasil",
        description: "Silahkan masukkan password baru Anda",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validasi Gagal",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Verifikasi Gagal",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verifikasi Gagal",
          description: "No Peserta atau NIK tidak sesuai",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = passwordSchema.parse(passwordData);
      
      // Call edge function to reset password
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          no_peserta: verifyData.no_peserta,
          nik: verifyData.nik,
          new_password: validated.new_password,
        }
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: data.message || "Password berhasil diubah. Silahkan login dengan password baru.",
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth-pppk');
      }, 2000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validasi Gagal",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset Password Gagal",
          description: "Terjadi kesalahan. Silahkan coba lagi.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 'verify' ? navigate('/auth-pppk') : setStep('verify')}
            className="w-fit -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 'verify' ? 'Kembali ke Login' : 'Kembali'}
          </Button>
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            {step === 'verify' 
              ? 'Verifikasi identitas Anda untuk reset password'
              : 'Masukkan password baru Anda'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'verify' ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="no_peserta">No Peserta</Label>
                <Input
                  id="no_peserta"
                  placeholder="Masukkan No Peserta"
                  value={verifyData.no_peserta}
                  onChange={(e) => setVerifyData({ ...verifyData, no_peserta: e.target.value })}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nik">NIK (16 digit)</Label>
                <Input
                  id="nik"
                  placeholder="Masukkan NIK 16 digit"
                  value={verifyData.nik}
                  onChange={(e) => setVerifyData({ ...verifyData, nik: e.target.value })}
                  disabled={loading}
                  maxLength={16}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Verifikasi"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">Password Baru</Label>
                <Input
                  id="new_password"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Konfirmasi Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  placeholder="Masukkan ulang password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengubah Password...
                  </>
                ) : (
                  "Ubah Password"
                )}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {step === 'verify' 
              ? 'Gunakan NIK dan No Peserta yang terdaftar'
              : 'Password akan segera diubah setelah Anda submit'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPPPK;
