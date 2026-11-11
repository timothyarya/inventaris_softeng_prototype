import { prisma } from "../../config/prisma";
import { conflict, notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import type { CategoryBody, ListCategoriesQuery } from "./schema";

const withCount = { _count: { select: { products: true } } } as const;

function toDto(c: { id: number; name: string; _count: { products: number } }) {
  return { id: c.id, name: c.name, productCount: c._count.products };
}

async function assertNameFree(name: string, exceptId?: number) {
  const dup = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw conflict("Kategori dengan nama tersebut sudah ada.", "CATEGORY_DUPLICATE");
}

export async function listCategories(query: ListCategoriesQuery) {
  const where = query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      include: withCount,
      ...skipTake(query),
    }),
    prisma.category.count({ where }),
  ]);
  return { data: rows.map(toDto), meta: pageMeta(query, total) };
}

export async function createCategory({ name }: CategoryBody) {
  await assertNameFree(name);
  const created = await prisma.category.create({ data: { name }, include: withCount });
  return toDto(created);
}

export async function updateCategory(id: number, { name }: CategoryBody) {
  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Kategori tidak ditemukan.");
  await assertNameFree(name, id);
  const updated = await prisma.category.update({
    where: { id },
    data: { name },
    include: withCount,
  });
  return toDto(updated);
}

export async function deleteCategory(id: number) {
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id }, include: withCount });
    if (!category) throw notFound("Kategori tidak ditemukan.");
    if (category._count.products > 0) {
      throw conflict(
        `Kategori masih dipakai ${category._count.products} produk. Pindahkan atau ubah kategori produk tersebut terlebih dahulu.`,
        "CATEGORY_IN_USE",
      );
    }
    await tx.category.delete({ where: { id } });
  });
}
