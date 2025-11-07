import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText, Video, Link as LinkIcon, HelpCircle, Loader2, ExternalLink } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface EBimtekItem {
  id: string;
  judul: string;
  konten: string;
  tipe_konten: string;
  urutan: number;
  is_active: boolean;
}

const EBimtek = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<EBimtekItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('e_bimtek')
        .select('*')
        .eq('is_active', true)
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

  const getIconByType = (type: string) => {
    switch (type) {
      case 'text':
        return <HelpCircle className="h-6 w-6 text-primary" />;
      case 'video':
        return <Video className="h-6 w-6 text-accent" />;
      case 'pdf':
        return <FileText className="h-6 w-6 text-warning" />;
      case 'link':
        return <LinkIcon className="h-6 w-6 text-muted-foreground" />;
      default:
        return <HelpCircle className="h-6 w-6" />;
    }
  };

  const renderContent = (item: EBimtekItem) => {
    switch (item.tipe_konten) {
      case 'text':
        return (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={item.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  {getIconByType(item.tipe_konten)}
                  <span className="font-semibold">{item.judul}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.konten}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      
      case 'video':
      case 'pdf':
      case 'link':
        return (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getIconByType(item.tipe_konten)}
                  <div>
                    <CardTitle className="text-lg">{item.judul}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.tipe_konten === 'video' && 'Video Tutorial'}
                      {item.tipe_konten === 'pdf' && 'Dokumen PDF'}
                      {item.tipe_konten === 'link' && 'Link External'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => window.open(item.konten, '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Buka
                </Button>
              </div>
            </CardHeader>
          </Card>
        );
      
      default:
        return null;
    }
  };

  const faqItems = items.filter(item => item.tipe_konten === 'text');
  const resourceItems = items.filter(item => ['video', 'pdf', 'link'].includes(item.tipe_konten));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">E-Bimtek PPPK</h1>
            <p className="text-muted-foreground text-lg">
              Panduan dan Tutorial untuk Calon PPPK
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Belum ada konten e-bimtek yang tersedia.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* FAQ Section */}
              {faqItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      Pertanyaan yang Sering Diajukan (FAQ)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {faqItems.map((item) => renderContent(item))}
                  </CardContent>
                </Card>
              )}

              {/* Resources Section */}
              {resourceItems.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    Materi dan Sumber Daya
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {resourceItems.map((item) => (
                      <div key={item.id}>{renderContent(item)}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EBimtek;
