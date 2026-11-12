import { z } from "zod";

export const dashboardQuerySchema = z.object({
  // Hanya Owner/Admin Gudang; diabaikan untuk Pegawai Cabang (selalu cabangnya sendiri).
  branchId: z.coerce
    .number({ error: "Cabang tidak valid" })
    .int("Cabang tidak valid")
    .positive("Cabang tidak valid")
    .optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
