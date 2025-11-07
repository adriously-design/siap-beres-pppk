import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

export const NotificationToast = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Subscribe to document verification updates
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_dokumen',
          filter: `status_verifikasi=neq.pending`
        },
        (payload) => {
          const status = payload.new.status_verifikasi;
          toast({
            title: "📄 Status Dokumen Diperbarui",
            description: `Dokumen Anda telah ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`,
            duration: 5000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_dokumen'
        },
        (payload) => {
          toast({
            title: "📤 Dokumen Baru Diupload",
            description: "Ada dokumen baru yang perlu direview",
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return null;
};
