import { prisma } from "../../src/config/prisma";
import { jakartaDate } from "../../src/utils/datetime";
import { login, type Session } from "./session";

let counter = 0;
const runId = Date.now().toString(36);

/** Akhiran unik per pemanggilan agar SKU, kode cabang, dan email tidak bentrok antar tes. */
export const uniq = () => `${runId}${(counter++).toString(36)}`.toUpperCase();

export const today = () => jakartaDate();

export async function createProduct(
  owner: Session,
  opts: { minStock?: number; name?: string } = {},
): Promise<number> {
  const res = await owner.post("/products", {
    sku: `T-${uniq()}`,
    name: opts.name ?? "Produk Tes",
    unit: "pcs",
    minStock: opts.minStock ?? 0,
  });
  if (res.status !== 201) throw new Error(`Buat produk gagal: ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

export async function createBranch(owner: Session): Promise<{ id: number; code: string }> {
  const code = `T${uniq()}`.slice(0, 20);
  const res = await owner.post("/branches", { code, name: `Cabang ${code}` });
  if (res.status !== 201) throw new Error(`Buat cabang gagal: ${JSON.stringify(res.body)}`);
  return { id: res.body.data.id, code };
}

/** Pegawai Cabang baru di cabang tertentu, langsung login. */
export async function createPegawai(owner: Session, branchId: number): Promise<Session> {
  const email = `t-${uniq().toLowerCase()}@softeng.local`;
  const res = await owner.post("/users", {
    name: "Pegawai Tes",
    email,
    password: "rahasia123",
    role: "PEGAWAI_CABANG",
    branchId,
  });
  if (res.status !== 201) throw new Error(`Buat user gagal: ${JSON.stringify(res.body)}`);
  return login(email, "rahasia123");
}

/** Stok masuk ke gudang utama; mengembalikan id dan nomor dokumennya. */
export async function stockIn(admin: Session, items: { productId: number; qty: number }[]) {
  const res = await admin.post("/stock-ins", { supplierName: "Supplier Tes", items });
  if (res.status !== 201) throw new Error(`Stok masuk gagal: ${JSON.stringify(res.body)}`);
  return { id: res.body.data.id as number, docNo: res.body.data.docNo as string };
}

export async function qtyOf(branchId: number, productId: number): Promise<number> {
  const row = await prisma.branchStock.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });
  return row?.qty ?? 0;
}

export async function mainBranchId(): Promise<number> {
  return (await prisma.branch.findFirstOrThrow({ where: { isMain: true } })).id;
}

export const movementsOf = (productId: number) =>
  prisma.stockMovement.findMany({ where: { productId }, orderBy: { id: "asc" } });

/** Alur transfer dari request sampai terkirim; mengembalikan id transfer dan id itemnya. */
export async function requestApproveSend(opts: {
  pegawai: Session;
  admin: Session;
  items: { productId: number; qty: number }[];
}) {
  const created = await opts.pegawai.post("/transfers/requests", { items: opts.items });
  if (created.status !== 201) throw new Error(`Request gagal: ${JSON.stringify(created.body)}`);
  const id = created.body.data.id as number;
  const approved = await opts.admin.post(`/transfers/${id}/approve`);
  if (approved.status !== 200) throw new Error(`Setujui gagal: ${JSON.stringify(approved.body)}`);
  const sent = await opts.admin.post(`/transfers/${id}/send`);
  return { id, sent };
}
