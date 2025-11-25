import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface BatchActionToolbarProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    batchNote: string;
    setBatchNote: (note: string) => void;
    onBatchUpdate: (status: 'verified' | 'rejected') => void;
    updating: boolean;
}

export function BatchActionToolbar({
    selectedCount,
    totalCount,
    onSelectAll,
    batchNote,
    setBatchNote,
    onBatchUpdate,
    updating,
}: BatchActionToolbarProps) {
    if (totalCount === 0) return null;

    return (
        <Card className="mb-4 bg-muted/50">
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={selectedCount === totalCount && totalCount > 0}
                                onCheckedChange={onSelectAll}
                            />
                            <span className="text-sm font-medium">
                                {selectedCount > 0 ? `${selectedCount} dipilih` : 'Pilih Semua'}
                            </span>
                        </div>

                        {selectedCount > 0 && (
                            <Textarea
                                placeholder="Catatan untuk batch action (opsional)"
                                value={batchNote}
                                onChange={(e) => setBatchNote(e.target.value)}
                                className="h-9 min-h-9 w-64"
                            />
                        )}
                    </div>

                    {selectedCount > 0 && (
                        <div className="flex gap-2">
                            <Button
                                onClick={() => onBatchUpdate('verified')}
                                disabled={updating}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Verifikasi {selectedCount} Dokumen
                            </Button>
                            <Button
                                onClick={() => onBatchUpdate('rejected')}
                                disabled={updating}
                                variant="destructive"
                                size="sm"
                            >
                                <XCircle className="h-4 w-4 mr-1" />
                                Tolak {selectedCount} Dokumen
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
