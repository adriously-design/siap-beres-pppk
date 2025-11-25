import { z } from "zod";

export const pppkLoginSchema = z.object({
    no_peserta: z.string().min(1, "No Peserta harus diisi").max(50, "No Peserta terlalu panjang"),
    password: z.string().min(1, "Password harus diisi"),
});

export const adminLoginSchema = z.object({
    email: z.string().email("Email tidak valid"),
    password: z.string().min(6, "Password minimal 6 karakter"),
});

export type PPPKLoginValues = z.infer<typeof pppkLoginSchema>;
export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
