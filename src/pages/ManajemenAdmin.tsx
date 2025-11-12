import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Trash2, ArrowLeft, Shield, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

interface AdminProfile {
  id: string;
  full_name: string;
  email?: string;
}

const ManajemenAdmin = () => {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    email: "",
    password: "",
    verification_key: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      
      // Get admin user IDs from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin_bkd");

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setAdmins([]);
        return;
      }

      const adminIds = rolesData.map(r => r.user_id);

      // Get profiles for these admin IDs
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", adminIds)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get emails from auth.users via RPC or edge function if needed
      // For now, we'll just show the profiles
      const adminProfiles = profilesData?.map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        email: undefined, // Email not accessible from profiles table
      })) || [];
      
      setAdmins(adminProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminFormData.email || !adminFormData.password || !adminFormData.verification_key) {
      toast({
        title: "Error",
        description: "Semua field harus diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { 
          action: 'create_admin',
          email: adminFormData.email,
          password: adminFormData.password,
          verification_key: adminFormData.verification_key,
        },
      });

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Admin baru berhasil dibuat",
      });

      setAdminFormData({ email: "", password: "", verification_key: "" });
      setAddAdminDialogOpen(false);
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedAdmin) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { 
          action: 'delete',
          userId: selectedAdmin.id
        },
      });

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Admin berhasil dihapus",
      });

      setDeleteDialogOpen(false);
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openViewDialog = (admin: AdminProfile) => {
    setSelectedAdmin(admin);
    setViewDialogOpen(true);
  };

  const openDeleteDialog = (admin: AdminProfile) => {
    setSelectedAdmin(admin);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Manajemen Admin
                </CardTitle>
                <CardDescription>
                  Kelola data Admin BKD yang terdaftar di sistem
                </CardDescription>
              </div>
              <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Tambah Admin
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tambah Admin Baru</DialogTitle>
                    <DialogDescription>
                      Masukkan data admin baru dengan kata kunci verifikasi
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={adminFormData.email}
                        onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                        placeholder="admin@bkd.id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={adminFormData.password}
                        onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                        placeholder="Minimal 8 karakter"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verification-key">Kata Kunci Verifikasi</Label>
                      <Input
                        id="verification-key"
                        type="password"
                        value={adminFormData.verification_key}
                        onChange={(e) => setAdminFormData({ ...adminFormData, verification_key: e.target.value })}
                        placeholder="Masukkan kata kunci verifikasi"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddAdminDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button onClick={handleAddAdmin}>Tambah Admin</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Belum ada data admin
                      </TableCell>
                    </TableRow>
                  ) : (
                    admins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>{admin.full_name}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            <Shield className="h-3 w-3 mr-1" /> Admin BKD
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openViewDialog(admin)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(admin)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Admin</DialogTitle>
            </DialogHeader>
            {selectedAdmin && (
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-muted-foreground">Nama Lengkap</Label>
                  <p className="font-medium">{selectedAdmin.full_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <div className="mt-2">
                    <Badge variant="destructive">
                      <Shield className="h-3 w-3 mr-1" /> Admin BKD
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewDialogOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Admin</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus admin ini? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ManajemenAdmin;
