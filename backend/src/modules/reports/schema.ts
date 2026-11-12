import { z } from "zod";
import { isValidDateString } from "../../utils/datetime";

const dateString = (label: string) =>
  z
    .string({ error: `${label} wajib diisi` })
    .refine(isValidDateString, `${label} tidak valid (format YYYY-MM-DD)`);

/** Filter umum kedua laporan (bagian 4.8): cabang opsional dan periode wajib (hari WIB, inklusif). */
export const reportQuerySchema = z
  .object({
    branchId: z.coerce
      .number({ error: "Cabang tidak valid" })
      .int("Cabang tidak valid")
      .positive("Cabang tidak valid")
      .optional(),
    from: dateString("Tanggal mulai"),
    to: dateString("Tanggal akhir"),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal mulai tidak boleh setelah tanggal akhir",
    path: ["from"],
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;
