import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const pppkLoginSchema = z.object({
  no_peserta: z.string().min(1, "No Peserta harus diisi").max(50, "No Peserta terlalu panjang"),
  nik: z.string().regex(/^\d{16}$/, "NIK harus 16 digit angka"),
});

const AuthPPPK = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    no_peserta: "",
    nik: "",
  });

  const handlePPPKLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = pppkLoginSchema.parse(formData);
      const email = `${validated.no_peserta}@pppk.local`;
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: formData.nik,
      });

      if (error) throw error;
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validasi Gagal",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login Gagal",
          description: "No Peserta atau password tidak valid",
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
          <CardTitle className="text-2xl font-bold text-center">SIAP BERES</CardTitle>
          <CardDescription className="text-center">
            Login Calon PPPK
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePPPKLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="no_peserta">No Peserta</Label>
              <Input
                id="no_peserta"
                placeholder="Masukkan No Peserta"
                value={formData.no_peserta}
                onChange={(e) => setFormData({ ...formData, no_peserta: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nik">Password</Label>
              <Input
                id="nik"
                type="password"
                placeholder="Masukkan Password"
                value={formData.nik}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Gunakan No Peserta dan Password yang diberikan oleh admin
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPPPK;
