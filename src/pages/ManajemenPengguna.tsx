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
import { Loader2, Eye, Trash2, ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ImportUserDialog } from "@/components/ImportUserDialog";
import { Navbar } from "@/components/Navbar";

interface UserProfile {
  id: string;
  full_name: string;
  nik: string | null;
  no_peserta: string | null;
  role?: 'calon_pppk' | 'admin_bkd';
}

const ManajemenPengguna = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({
    no_peserta: "",
    nik: "",
    full_name: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles separately
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to profiles and filter only PPPK users
      const usersWithRoles = profilesData?.map(profile => {
        const userRole = rolesData?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          full_name: profile.full_name,
          nik: profile.nik,
          no_peserta: profile.no_peserta,
          role: (userRole?.role as 'calon_pppk' | 'admin_bkd') || 'calon_pppk'
        };
      }).filter(user => user.role === 'calon_pppk') || [];
      
      setUsers(usersWithRoles);
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

  const handleAddUser = async () => {
    if (!userFormData.no_peserta || !userFormData.nik || !userFormData.full_name) {
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
          action: 'create',
          userData: {
            no_peserta: userFormData.no_peserta,
            nik: userFormData.nik,
            full_name: userFormData.full_name,
          }
        },
      });

      if (error) throw error;

      toast({
        title: "Sukses",
        description: `User PPPK berhasil dibuat. Password: ${data.password}`,
        duration: 10000,
      });

      setUserFormData({ no_peserta: "", nik: "", full_name: "" });
      setAddUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { 
          action: 'delete',
          userId: selectedUser.id
        },
      });

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "User berhasil dihapus",
      });

      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openViewDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };

  const openDeleteDialog = (user: UserProfile) => {
    setSelectedUser(user);
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
                <CardTitle>Manajemen Pengguna</CardTitle>
                <CardDescription>
                  Kelola data Calon PPPK yang terdaftar di sistem
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Tambah Data</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tambah User PPPK Baru</DialogTitle>
                      <DialogDescription>
                        Masukkan data calon PPPK yang akan ditambahkan
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="no-peserta">No Peserta</Label>
                        <Input
                          id="no-peserta"
                          value={userFormData.no_peserta}
                          onChange={(e) => setUserFormData({ ...userFormData, no_peserta: e.target.value })}
                          placeholder="Masukkan nomor peserta"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nik">NIK</Label>
                        <Input
                          id="nik"
                          value={userFormData.nik}
                          onChange={(e) => setUserFormData({ ...userFormData, nik: e.target.value })}
                          placeholder="Masukkan NIK"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="full-name">Nama Lengkap</Label>
                        <Input
                          id="full-name"
                          value={userFormData.full_name}
                          onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                          placeholder="Masukkan nama lengkap"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleAddUser}>Tambah User</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <ImportUserDialog onImportSuccess={fetchUsers} />
              </div>
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
                    <TableHead>No Peserta</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Belum ada data user
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.no_peserta || "-"}</TableCell>
                        <TableCell>{user.nik || "-"}</TableCell>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openViewDialog(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(user)}
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
              <DialogTitle>Detail User</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-muted-foreground">No Peserta</Label>
                  <p className="font-medium">{selectedUser.no_peserta || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">NIK</Label>
                  <p className="font-medium">{selectedUser.nik || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nama Lengkap</Label>
                  <p className="font-medium">{selectedUser.full_name}</p>
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
              <AlertDialogTitle>Hapus User</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.
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

export default ManajemenPengguna;
