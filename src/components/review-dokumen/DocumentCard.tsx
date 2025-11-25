import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { UserDokumenItem, VerificationStatus } from "@/types";

interface DocumentCardProps {
    doc: UserDokumenItem;
    selected: boolean;
    onSelect: () => void;
    adminNote: string;
    onNoteChange: (note: string) => void;
    onPreview: () => void;
    onUpdateStatus: (status: VerificationStatus) => void;
    onViewHistory: () => void;
    updating: boolean;
    isVerified: boolean;
    isRejected: boolean;
}

export function DocumentCard({
    doc,
    selected,
    onSelect,
    adminNote,
    onNoteChange,
    onPreview,
    onUpdateStatus,
    onViewHistory,
    updating,
    isVerified,
    isRejected
}: DocumentCardProps) {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'verified':
                return <Badge className="bg-green-600">Terverifikasi</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Ditolak</Badge>;
            default:
                return <Badge className="bg-yellow-600">Pending</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <Checkbox
                                checked={selected}
                                onCheckedChange={onSelect}
                            />
                            <CardTitle className="text-lg">{doc.dokumen.nama_dokumen}</CardTitle>
                            {getStatusBadge(doc.status_verifikasi)}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{doc.dokumen.deskripsi}</p>
                        <p className="text-xs font-medium text-muted-foreground">
                            Upload: {new Date(doc.uploaded_at).toLocaleDateString('id-ID')} • {doc.file_name}
                        </p>
                    </div>
                    {doc.catatan_history && doc.catatan_history.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onViewHistory}
                        >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            <span className="text-xs">Riwayat ({doc.catatan_history.length})</span>
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {doc.catatan_user && (
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <Label className="text-xs font-medium text-blue-900 dark:text-blue-100">
                            Catatan dari PPPK:
                        </Label>
                        <p className="text-xs mt-1 text-blue-800 dark:text-blue-200">
                            {doc.catatan_user}
                        </p>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label htmlFor={`notes-${doc.id}`} className="text-sm">Catatan Admin</Label>
                    <Textarea
                        id={`notes-${doc.id}`}
                        value={adminNote}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="Tambahkan catatan atau feedback..."
                        className="min-h-[80px] text-sm"
                        disabled={updating}
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={onPreview}
                        size="sm"
                        className="flex-1"
                    >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Lihat
                    </Button>
                    <Button
                        onClick={() => onUpdateStatus('verified')}
                        disabled={updating || isVerified}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {updating ? 'Proses...' : 'Verifikasi'}
                    </Button>
                    <Button
                        onClick={() => onUpdateStatus('rejected')}
                        disabled={updating || isRejected}
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                    >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {updating ? 'Proses...' : 'Tolak'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
