import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Shield } from "lucide-react";
import { z } from "zod";

const pppkLoginSchema = z.object({
  no_peserta: z.string().min(1, { message: "No Peserta harus diisi" }),
  nik: z.string().length(16, { message: "NIK harus 16 digit" }),
});

const adminLoginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [pppkLoginData, setPppkLoginData] = useState({ no_peserta: "", nik: "" });
  const [adminLoginData, setAdminLoginData] = useState({ email: "", password: "" });

  const handlePPPKLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = pppkLoginSchema.parse(pppkLoginData);
      
      // Convert no_peserta to email format and use nik as password
      const email = `${validated.no_peserta}@pppk.local`;
      
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: validated.nik,
      });

      if (error) throw error;

      toast({
        title: "Login berhasil",
        description: "Selamat datang di SIAP BERES",
      });
      
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login gagal",
        description: error.message || "No Peserta atau NIK tidak valid",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = adminLoginSchema.parse(adminLoginData);
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Login berhasil",
        description: "Selamat datang Admin BKD",
      });
      
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login gagal",
        description: error.message || "Email atau password salah",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <FileCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-balance">SIAP BERES</h1>
          <p className="text-muted-foreground mt-2">
            Sistem Informasi Administrasi PPPK<br />Berkas Sesuai
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selamat Datang</CardTitle>
            <CardDescription>
              Pilih metode login sesuai peran Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pppk" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pppk">Calon PPPK</TabsTrigger>
                <TabsTrigger value="admin">Admin BKD</TabsTrigger>
              </TabsList>

              <TabsContent value="pppk">
                <form onSubmit={handlePPPKLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pppk-peserta">No. Peserta</Label>
                    <Input
                      id="pppk-peserta"
                      type="text"
                      placeholder="Masukkan nomor peserta Anda"
                      value={pppkLoginData.no_peserta}
                      onChange={(e) =>
                        setPppkLoginData({ ...pppkLoginData, no_peserta: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pppk-nik">NIK</Label>
                    <Input
                      id="pppk-nik"
                      type="text"
                      placeholder="16 digit NIK"
                      maxLength={16}
                      value={pppkLoginData.nik}
                      onChange={(e) =>
                        setPppkLoginData({ ...pppkLoginData, nik: e.target.value })
                      }
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Loading..." : "Login"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="email@bkd.go.id"
                      value={adminLoginData.email}
                      onChange={(e) =>
                        setAdminLoginData({ ...adminLoginData, email: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={adminLoginData.password}
                      onChange={(e) =>
                        setAdminLoginData({ ...adminLoginData, password: e.target.value })
                      }
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Loading..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Shield className="inline-block h-4 w-4 mr-1" />
          Data Anda aman dan terenkripsi
        </div>
      </div>
    </div>
  );
}
