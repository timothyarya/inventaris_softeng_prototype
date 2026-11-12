import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma";
import { createProduct, mainBranchId, stockIn, today } from "./helpers/fixtures";
import { anonymous, loginSeed } from "./helpers/session";

// Kriteria selesai Fase 8 dan akses laporan (bagian 4.8 dan 7).
describe("laporan", () => {
  it("stok awal + pergerakan = stok akhir, dan stok akhir sampai hari ini = branch_stocks.qty", async () => {
    const owner = await loginSeed.owner();
    const admin = await loginSeed.adminGudang();
    const cb01 = await loginSeed.pegawaiCb01();
    const productId = await createProduct(owner, { minStock: 5 });
    await stockIn(admin, [{ productId, qty: 40 }]);
    const sent = await admin.post("/transfers/direct", {
      toBranchId: cb01.user.branch!.id,
      items: [{ productId, qty: 12 }],
    });
    await cb01.post(`/transfers/${sent.body.data.id}/receive`, {});

    const res = await owner.get(`/reports/stock?from=2000-01-01&to=${today()}`);
    expect(res.status).toBe(200);
    type Row = {
      branch: { id: number };
      product: { id: number };
      opening: number;
      masuk: number;
      transferIn: number;
      transferOut: number;
      opname: number;
      closing: number;
    };
    const rows: Row[] = res.body.data.rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.opening + r.masuk + r.transferIn + r.transferOut + r.opname).toBe(r.closing);
    }

    const stocks = await prisma.branchStock.findMany();
    const closingOf = new Map(rows.map((r) => [`${r.branch.id}:${r.product.id}`, r.closing]));
    for (const s of stocks) {
      expect(
        closingOf.get(`${s.branchId}:${s.productId}`) ?? 0,
        `${s.branchId}:${s.productId}`,
      ).toBe(s.qty);
    }

    // Pasangan baru kita: gudang 28, CB01 12.
    const gdg = await mainBranchId();
    expect(closingOf.get(`${gdg}:${productId}`)).toBe(28);
    expect(closingOf.get(`${cb01.user.branch!.id}:${productId}`)).toBe(12);
  });

  it("periode sebelum data: stok awal 0 dan tidak ada baris; periode setelahnya: stok awal = stok akhir", async () => {
    const owner = await loginSeed.owner();
    const admin = await loginSeed.adminGudang();
    const productId = await createProduct(owner);
    await stockIn(admin, [{ productId, qty: 9 }]);
    const gdg = await mainBranchId();

    const past = await owner.get(`/reports/stock?branchId=${gdg}&from=2000-01-01&to=2000-01-31`);
    expect(
      past.body.data.rows.some((r: { product: { id: number } }) => r.product.id === productId),
    ).toBe(false);

    const future = await owner.get(`/reports/stock?branchId=${gdg}&from=2999-01-01&to=2999-01-31`);
    const row = future.body.data.rows.find(
      (r: { product: { id: number } }) => r.product.id === productId,
    );
    expect(row).toMatchObject({ opening: 9, masuk: 0, closing: 9 });
  });

  it("hanya Owner dan Admin Gudang; periode wajib dan valid", async () => {
    const owner = await loginSeed.owner();
    const admin = await loginSeed.adminGudang();
    const cb01 = await loginSeed.pegawaiCb01();
    const qs = `from=${today()}&to=${today()}`;

    for (const kind of ["stock", "distribution"]) {
      expect((await anonymous().get(`/api/reports/${kind}?${qs}`)).status).toBe(401);
      expect((await cb01.get(`/reports/${kind}?${qs}`)).status).toBe(403);
      expect((await admin.get(`/reports/${kind}?${qs}`)).status).toBe(200);
      expect((await owner.get(`/reports/${kind}?${qs}`)).status).toBe(200);
      expect((await owner.get(`/reports/${kind}?to=${today()}`)).status).toBe(400);
      expect((await owner.get(`/reports/${kind}?from=2026-02-30&to=${today()}`)).status).toBe(400);
      expect((await owner.get(`/reports/${kind}?from=2026-05-02&to=2026-05-01`)).status).toBe(400);
      expect((await owner.get(`/reports/${kind}?branchId=99999999&${qs}`)).status).toBe(404);
    }
  });
});
