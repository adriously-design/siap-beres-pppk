import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface MessageHistoryItem {
  type: 'admin' | 'user';
  message: string;
  timestamp: string;
}

interface MessageHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: MessageHistoryItem[];
  userName: string;
}

export function MessageHistoryDialog({ 
  open, 
  onOpenChange, 
  history,
  userName 
}: MessageHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Riwayat Komunikasi</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada riwayat komunikasi
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.type === 'admin' ? 'default' : 'secondary'} className="text-xs">
                      {item.type === 'admin' ? 'Admin BKD' : userName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    item.type === 'admin' 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-secondary/50 border border-secondary'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
