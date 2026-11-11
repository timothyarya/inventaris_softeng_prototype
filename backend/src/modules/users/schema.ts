import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";
import { passwordSchema } from "../../utils/password";

const name = z
  .string({ error: "Nama wajib diisi" })
  .trim()
  .min(1, "Nama wajib diisi")
  .max(100, "Nama maksimal 100 karakter");
const email = z
  .string({ error: "Email wajib diisi" })
  .trim()
  .toLowerCase()
  .max(150, "Email maksimal 150 karakter")
  .pipe(z.email({ error: "Format email tidak valid" }));
const role = z.enum(["OWNER", "ADMIN_GUDANG", "PEGAWAI_CABANG"], { error: "Role tidak valid" });
const branchId = z
  .number({ error: "Cabang tidak valid" })
  .int("Cabang tidak valid")
  .positive("Cabang tidak valid")
  .nullable();

const NO_BRANCH_MESSAGE = "Owner/Admin Gudang tidak boleh terikat ke cabang";

export const createUserSchema = z
  .object({
    name,
    email,
    password: passwordSchema,
    role,
    branchId: branchId.optional().transform((v) => v ?? null),
  })
  .superRefine((v, ctx) => {
    if (v.role !== "PEGAWAI_CABANG" && v.branchId !== null) {
      ctx.addIssue({ code: "custom", path: ["branchId"], message: NO_BRANCH_MESSAGE });
    }
  });

export const updateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: passwordSchema.optional(),
    role: role.optional(),
    branchId: branchId.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { error: "Tidak ada data yang diubah" })
  .superRefine((v, ctx) => {
    if (v.role !== undefined && v.role !== "PEGAWAI_CABANG" && v.branchId != null) {
      ctx.addIssue({ code: "custom", path: ["branchId"], message: NO_BRANCH_MESSAGE });
    }
  });

export const listUsersQuerySchema = z.object({
  ...paginationQuery,
  q: z.string().trim().optional(),
  role: role.optional(),
  /** Id cabang, atau "none" untuk user yang belum punya cabang. */
  branchId: z.union([z.literal("none"), z.coerce.number().int().positive()]).optional(),
  status: z.enum(["active", "inactive", "all"]).default("all"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
