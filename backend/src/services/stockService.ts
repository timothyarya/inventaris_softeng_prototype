import type { MovementType, Prisma, RefType } from "../generated/prisma/client";
import { unprocessable } from "../utils/errors";

/** Batas integer 32-bit PostgreSQL (kolom qty bertipe INTEGER). */
const INT_MAX = 2_147_483_647;

export type ApplyMovementInput = {
  branchId: number;
  productId: number;
  /** Perubahan bertanda: positif menambah, negatif mengurangi. Tidak boleh 0. */
  delta: number;
  type: MovementType;
  refType: RefType;
  refId: number;
  refDocNo: string;
  userId: number;
};

export type MovementResult = { qtyBefore: number; qtyAfter: number };

/**
 * Satu-satunya jalan mengubah `branch_stocks` (bagian 5.1). Harus dipanggil di dalam
 * `prisma.$transaction` milik pemanggil agar seluruh aksi bersifat atomik:
 *  1. pastikan baris stok ada (qty 0 bila belum),
 *  2. kunci baris dengan `FOR UPDATE`,
 *  3. tolak (422) bila saldo hasil negatif,
 *  4. perbarui qty,
 *  5. tulis satu baris `stock_movements` berisi saldo setelahnya.
 *
 * Bila banyak item diproses dalam satu transaksi, urutkan berdasarkan productId agar
 * urutan penguncian konsisten dan tidak terjadi deadlock antar transaksi.
 */
export async function applyMovement(
  tx: Prisma.TransactionClient,
  input: ApplyMovementInput,
): Promise<MovementResult> {
  const { branchId, productId, delta } = input;
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`applyMovement: delta harus bilangan bulat bukan nol (diterima ${delta}).`);
  }

  await tx.$executeRaw`
    INSERT INTO branch_stocks (branch_id, product_id, qty, updated_at)
    VALUES (${branchId}, ${productId}, 0, now())
    ON CONFLICT (branch_id, product_id) DO NOTHING`;

  const locked = await tx.$queryRaw<{ qty: number }[]>`
    SELECT qty FROM branch_stocks
    WHERE branch_id = ${branchId} AND product_id = ${productId}
    FOR UPDATE`;
  const qtyBefore = locked[0]?.qty;
  if (qtyBefore === undefined) throw new Error("applyMovement: baris stok tidak ditemukan.");

  const qtyAfter = qtyBefore + delta;
  if (qtyAfter < 0) {
    throw unprocessable(
      `Stok tidak cukup. Tersedia ${qtyBefore}, dibutuhkan ${Math.abs(delta)}.`,
      "INSUFFICIENT_STOCK",
    );
  }
  if (qtyAfter > INT_MAX) {
    throw unprocessable(
      "Jumlah stok melebihi batas maksimum yang dapat disimpan.",
      "STOCK_OVERFLOW",
    );
  }

  await tx.$executeRaw`
    UPDATE branch_stocks SET qty = ${qtyAfter}, updated_at = now()
    WHERE branch_id = ${branchId} AND product_id = ${productId}`;

  await tx.stockMovement.create({
    data: {
      branchId,
      productId,
      type: input.type,
      qty: delta,
      balanceAfter: qtyAfter,
      refType: input.refType,
      refId: input.refId,
      refDocNo: input.refDocNo,
      userId: input.userId,
    },
  });

  return { qtyBefore, qtyAfter };
}
