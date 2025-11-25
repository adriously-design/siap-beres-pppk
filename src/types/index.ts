export type VerificationStatus = 'verified' | 'rejected' | 'pending';

export interface UserProfile {
    full_name: string;
    no_peserta: string;
}

export interface DokumenItem {
    id: string;
    nama_dokumen: string;
    deskripsi: string;
}

export interface HistoryItem {
    type: 'admin' | 'user' | 'system';
    message: string;
    timestamp: string;
    admin_id?: string;
    action?: string;
}

export interface UserDokumenItem {
    id: string;
    dokumen_id: string;
    file_name: string;
    file_path: string;
    status_verifikasi: VerificationStatus | string;
    catatan_admin: string | null;
    catatan_user: string | null;
    catatan_history: HistoryItem[];
    uploaded_at: string;
    dokumen: DokumenItem;
}
