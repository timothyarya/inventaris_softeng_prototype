import { prisma } from "../../config/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { conflict, notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import type { AuthUser } from "../auth/service";
import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./schema";

const productInclude = { category: { select: { id: true, name: true } } } as const;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toDto(p: ProductRow) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    category: p.category,
    unit: p.unit,
    minStock: p.minStock,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function assertSkuFree(sku: string, exceptId?: number) {
  const dup = await prisma.product.findFirst({
    where: {
      sku: { equals: sku, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw conflict(`SKU "${sku}" sudah dipakai produk lain.`, "SKU_DUPLICATE");
}

async function assertCategoryExists(categoryId: number | null | undefined) {
  if (categoryId == null) return;
  const found = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!found) throw notFound("Kategori tidak ditemukan.");
}

export async function listProducts(query: ListProductsQuery, user: AuthUser) {
  // Pegawai hanya melihat produk aktif (bagian 7).
  const status = user.role === "PEGAWAI" ? "active" : query.status;

  const where: Prisma.ProductWhereInput = {
    ...(status === "active"
      ? { isActive: true }
      : status === "inactive"
        ? { isActive: false }
        : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.q
      ? {
          OR: [
            { sku: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { sku: "asc" },
      include: productInclude,
      ...skipTake(query),
    }),
    prisma.product.count({ where }),
  ]);
  return { data: rows.map(toDto), meta: pageMeta(query, total) };
}

export async function getProduct(id: number) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw notFound("Produk tidak ditemukan.");
  return toDto(product);
}

export async function createProduct(input: CreateProductInput) {
  await assertSkuFree(input.sku);
  await assertCategoryExists(input.categoryId);
  const created = await prisma.product.create({
    data: {
      sku: input.sku,
      name: input.name,
      unit: input.unit,
      minStock: input.minStock,
      categoryId: input.categoryId,
    },
    include: productInclude,
  });
  return toDto(created);
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Produk tidak ditemukan.");
  if (input.sku !== undefined) await assertSkuFree(input.sku, id);
  await assertCategoryExists(input.categoryId);
  const updated = await prisma.product.update({
    where: { id },
    data: input,
    include: productInclude,
  });
  return toDto(updated);
}

export async function setProductActive(id: number, isActive: boolean) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, select: { isActive: true } });
    if (!product) throw notFound("Produk tidak ditemukan.");
    if (product.isActive === isActive) {
      throw conflict(
        isActive ? "Produk sudah aktif." : "Produk sudah nonaktif.",
        "PRODUCT_STATE_UNCHANGED",
      );
    }
    const updated = await tx.product.update({
      where: { id },
      data: { isActive },
      include: productInclude,
    });
    return toDto(updated);
  });
}

/**
 * Bagian 4.3: produk hanya boleh dihapus jika belum pernah punya pergerakan stok.
 * Referensi ke dokumen lain (stok masuk, transfer, opname) juga menghalangi, karena
 * menghapusnya akan merusak dokumen tersebut.
 */
export async function deleteProduct(id: number) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw notFound("Produk tidak ditemukan.");

    const movements = await tx.stockMovement.count({ where: { productId: id } });
    if (movements > 0) {
      throw conflict(
        "Produk sudah pernah punya pergerakan stok sehingga tidak dapat dihapus. Nonaktifkan produk ini sebagai gantinya.",
        "PRODUCT_HAS_MOVEMENTS",
      );
    }

    const [stockIns, transfers, opnames] = await Promise.all([
      tx.stockInItem.count({ where: { productId: id } }),
      tx.stockTransferItem.count({ where: { productId: id } }),
      tx.stockOpnameItem.count({ where: { productId: id } }),
    ]);
    if (stockIns + transfers + opnames > 0) {
      throw conflict(
        "Produk masih tercatat di dokumen (stok masuk, transfer, atau opname) sehingga tidak dapat dihapus. Nonaktifkan produk ini sebagai gantinya.",
        "PRODUCT_IN_DOCUMENTS",
      );
    }

    // Baris stok kosong (tanpa movement) tidak bermakna dan ikut dibersihkan.
    await tx.branchStock.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
  });
}
