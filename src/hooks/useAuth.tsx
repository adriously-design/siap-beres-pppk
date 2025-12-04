import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const useLogin = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const login = async (
        email: string,
        password: string,
        roleCheck: boolean = true,
        successRedirect?: string
    ) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (roleCheck) {
                // Fetch user role to determine redirect
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', data.user.id)
                    .single();

                // Redirect based on role
                if (roleData?.role === 'admin_bkd') {
                    navigate("/dashboard-admin");
                } else {
                    navigate("/dashboard-pppk");
                }
            } else if (successRedirect) {
                navigate(successRedirect);
            }

            toast({
                title: "Login Berhasil",
                description: "Selamat datang di SIAP BERES",
            });

      return true;
        } catch (error: any) {
            logger.error("Login error:", error);
            toast({
                title: "Login Gagal",
                description: error.message || "Email atau password tidak valid",
                variant: "destructive",
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { login, loading };
};
