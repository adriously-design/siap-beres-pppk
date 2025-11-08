import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, ArrowLeft, Loader2, Eye, ExternalLink } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface EBimtekItem {
  id: string;
  judul: string;
  konten: string;
  tipe_konten: string;
  urutan: number;
  is_active: boolean;
}

const KelolaEBimtek = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<EBimtekItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EBimtekItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formData, setFormData] = useState({
    judul: "",
    konten: "",
    tipe_konten: "text",
    urutan: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('e_bimtek')
        .select('*')
        .order('urutan', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('e_bimtek')
          .update({
            judul: formData.judul,
            konten: formData.konten,
            tipe_konten: formData.tipe_konten,
            urutan: formData.urutan,
            is_active: formData.is_active,
          })
          .eq('id', editingItem.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Konten e-bimtek berhasil diperbarui",
        });
      } else {
        // Create new item
        const { error } = await supabase
          .from('e_bimtek')
          .insert({
            judul: formData.judul,
            konten: formData.konten,
            tipe_konten: formData.tipe_konten,
            urutan: formData.urutan,
            is_active: formData.is_active,
          });

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Konten e-bimtek berhasil ditambahkan",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleEdit = (item: EBimtekItem) => {
    setEditingItem(item);
    setFormData({
      judul: item.judul,
      konten: item.konten,
      tipe_konten: item.tipe_konten,
      urutan: item.urutan,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('e_bimtek')
        .delete()
        .eq('id', itemToDelete);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Konten e-bimtek berhasil dihapus",
      });

      fetchItems();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      judul: "",
      konten: "",
      tipe_konten: "text",
      urutan: 0,
      is_active: true,
    });
    setEditingItem(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Kelola E-Bimtek</CardTitle>
                <CardDescription>Kelola konten e-bimtek untuk calon PPPK</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Konten
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit' : 'Tambah'} Konten E-Bimtek</DialogTitle>
                    <DialogDescription>
                      {editingItem ? 'Perbarui' : 'Tambahkan'} konten e-bimtek untuk ditampilkan kepada calon PPPK
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="judul">Judul</Label>
                      <Input
                        id="judul"
                        value={formData.judul}
                        onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                        placeholder="Masukkan judul"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipe_konten">Tipe Konten</Label>
                      <Select
                        value={formData.tipe_konten}
                        onValueChange={(value) => setFormData({ ...formData, tipe_konten: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Teks</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="link">Link</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="konten">Konten</Label>
                      <Textarea
                        id="konten"
                        value={formData.konten}
                        onChange={(e) => setFormData({ ...formData, konten: e.target.value })}
                        placeholder="Masukkan konten (teks, URL video, URL PDF, atau link)"
                        rows={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="urutan">Urutan</Label>
                      <Input
                        id="urutan"
                        type="number"
                        value={formData.urutan}
                        onChange={(e) => setFormData({ ...formData, urutan: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_active" className="cursor-pointer">Aktif</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setPreviewOpen(true)} className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button onClick={handleSubmit} className="flex-1">
                        {editingItem ? 'Perbarui' : 'Simpan'}
                      </Button>
                      <Button variant="outline" onClick={() => handleDialogClose(false)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Belum ada konten e-bimtek. Klik tombol "Tambah Konten" untuk menambahkan.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.judul}</CardTitle>
                          <CardDescription>
                            Tipe: {item.tipe_konten} | Urutan: {item.urutan} | Status: {item.is_active ? 'Aktif' : 'Tidak Aktif'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">{item.konten}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus konten e-bimtek ini? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview Konten</DialogTitle>
              <DialogDescription>
                Ini adalah tampilan yang akan dilihat oleh calon PPPK
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {formData.tipe_konten === 'text' ? (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="preview">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{formData.judul || 'Judul Preview'}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {formData.konten || 'Konten akan muncul di sini...'}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{formData.judul || 'Judul Preview'}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formData.tipe_konten === 'video' && 'Video Tutorial'}
                          {formData.tipe_konten === 'pdf' && 'Dokumen PDF'}
                          {formData.tipe_konten === 'link' && 'Link External'}
                        </p>
                      </div>
                      <Button
                        onClick={() => formData.konten && window.open(formData.konten, '_blank')}
                        variant="outline"
                        size="sm"
                        disabled={!formData.konten}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Buka
                      </Button>
                    </div>
                  </CardHeader>
                  {formData.konten && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">URL: {formData.konten}</p>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default KelolaEBimtek;
