import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugAdmin() {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAccess();
    }, []);

    const checkAccess = async () => {
        const result: any = {};

        // 1. Check User
        const { data: { user } } = await supabase.auth.getUser();
        result.user = user;

        if (user) {
            // 2. Check Role
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('*')
                .eq('user_id', user.id);
            result.roles = roleData;
            result.roleError = roleError;

            // 3. Check User Dokumen Access (Count)
            const { count, error: docError } = await supabase
                .from('user_dokumen')
                .select('*', { count: 'exact', head: true });

            result.docCount = count;
            result.docError = docError;

            // 4. Check specific query used in RiwayatAktivitas
            const { data: queryData, error: queryError } = await supabase
                .from('user_dokumen')
                .select('id, status_verifikasi, verified_at')
                .in('status_verifikasi', ['verified', 'rejected'])
                .not('verified_at', 'is', null)
                .limit(5);

            result.querySample = queryData;
            result.queryError = queryError;
        }

        setInfo(result);
        setLoading(false);
    };

    return (
        <div className="p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Debug Admin Access</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? "Loading..." : (
                        <pre className="bg-slate-950 text-slate-50 p-4 rounded overflow-auto max-h-[500px]">
                            {JSON.stringify(info, null, 2)}
                        </pre>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
