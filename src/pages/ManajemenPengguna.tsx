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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Eye, Edit, Trash2, ArrowLeft, Shield } from "lucide-react";
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    no_peserta: "",
    nik: "",
    full_name: "",
    role: "calon_pppk" as 'calon_pppk' | 'admin_bkd',
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!user_id(role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const usersWithRoles = data?.map(user => ({
        id: user.id,
        full_name: user.full_name,
        nik: user.nik,
        no_peserta: user.no_peserta,
        role: (user.user_roles as any)?.[0]?.role || 'calon_pppk'
      })) || [];
      
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

  const handleAdd = async () => {
    if (!formData.no_peserta || !formData.nik || !formData.full_name) {
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
            no_peserta: formData.no_peserta,
            nik: formData.nik,
            full_name: formData.full_name,
            role: formData.role
          }
        },
      });

      if (error) throw error;

      // Show password to admin
      toast({
        title: "Sukses",
        description: `User berhasil ditambahkan. Password: ${data.password}`,
        duration: 10000,
      });

      // Also prompt to copy password
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data.password);
        toast({
          title: "Password disalin",
          description: "Password telah disalin ke clipboard",
        });
      }

      setFormData({ no_peserta: "", nik: "", full_name: "", role: "calon_pppk" });
      setAddDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { 
          action: 'update',
          userId: selectedUser.id,
          userData: {
            no_peserta: formData.no_peserta,
            nik: formData.nik,
            full_name: formData.full_name
          },
          role: formData.role
        },
      });

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Data user berhasil diupdate",
      });

      setEditDialogOpen(false);
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

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      no_peserta: user.no_peserta || "",
      nik: user.nik || "",
      full_name: user.full_name,
      role: user.role || "calon_pppk",
    });
    setEditDialogOpen(true);
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
                <ImportUserDialog />
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Manual
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tambah User Calon PPPK</DialogTitle>
                      <DialogDescription>
                        Masukkan data user baru secara manual
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="add-no-peserta">No Peserta</Label>
                        <Input
                          id="add-no-peserta"
                          value={formData.no_peserta}
                          onChange={(e) => setFormData({ ...formData, no_peserta: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-nik">NIK (16 Digit)</Label>
                        <Input
                          id="add-nik"
                          value={formData.nik}
                          onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                          maxLength={16}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-nama">Nama Lengkap</Label>
                        <Input
                          id="add-nama"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-role">Role</Label>
                        <Select 
                          value={formData.role} 
                          onValueChange={(value: 'calon_pppk' | 'admin_bkd') => 
                            setFormData({ ...formData, role: value })
                          }
                        >
                          <SelectTrigger id="add-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="calon_pppk">Calon PPPK</SelectItem>
                            <SelectItem value="admin_bkd">
                              <div className="flex items-center">
                                <Shield className="h-4 w-4 mr-2" />
                                Admin BKD
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleAdd}>Tambah</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                    <TableHead>Role</TableHead>
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
                        <TableCell>
                          <Badge variant={user.role === 'admin_bkd' ? 'destructive' : 'default'}>
                            {user.role === 'admin_bkd' ? (
                              <><Shield className="h-3 w-3 mr-1" /> Admin BKD</>
                            ) : (
                              'Calon PPPK'
                            )}
                          </Badge>
                        </TableCell>
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
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="h-4 w-4" />
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
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <Badge variant={selectedUser.role === 'admin_bkd' ? 'destructive' : 'default'}>
                    {selectedUser.role === 'admin_bkd' ? (
                      <><Shield className="h-3 w-3 mr-1" /> Admin BKD</>
                    ) : (
                      'Calon PPPK'
                    )}
                  </Badge>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewDialogOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update data user Calon PPPK
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-no-peserta">No Peserta</Label>
                <Input
                  id="edit-no-peserta"
                  value={formData.no_peserta}
                  onChange={(e) => setFormData({ ...formData, no_peserta: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nik">NIK (16 Digit)</Label>
                <Input
                  id="edit-nik"
                  value={formData.nik}
                  onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                  maxLength={16}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nama">Nama Lengkap</Label>
                <Input
                  id="edit-nama"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: 'calon_pppk' | 'admin_bkd') => 
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calon_pppk">Calon PPPK</SelectItem>
                    <SelectItem value="admin_bkd">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin BKD
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleEdit}>Simpan</Button>
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
