import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma";
import {
  createBranch,
  createPegawai,
  createProduct,
  mainBranchId,
  stockIn,
  uniq,
} from "./helpers/fixtures";
import { anonymous, loginSeed } from "./helpers/session";

// Skenario uji wajib 9–14: nonaktifkan cabang/gudang/user, hapus produk, scoping query, dan
// constraint gudang utama di level database.
describe("siklus hidup master data dan scoping", () => {
  it("9. nonaktif cabang saat ada transfer DIKIRIM → 409; setelah DITERIMA berhasil dan efek berantai berjalan", async () => {
    const owner = await loginSeed.owner();
    const admin = await loginSeed.adminGudang();
    const branch = await createBranch(owner);
    const pegawai = await createPegawai(owner, branch.id);
    const productId = await createProduct(owner);
    await stockIn(admin, [{ productId, qty: 50 }]);

    const direct = await admin.post("/transfers/direct", {
      toBranchId: branch.id,
      items: [{ productId, qty: 10 }],
    });
    expect(direct.status).toBe(201);
    expect(direct.body.data.status).toBe("DIKIRIM");

    const blocked = await owner.patch(`/branches/${branch.id}/deactivate`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("BRANCH_HAS_OPEN_TRANSFERS");
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).isActive).toBe(
      true,
    );

    const received = await pegawai.post(`/transfers/${direct.body.data.id}/receive`);
    expect(received.status).toBe(200);

    // Request DIAJUKAN yang masih menggantung harus ikut dibatalkan saat cabang dinonaktifkan.
    const request = await pegawai.post("/transfers/requests", { items: [{ productId, qty: 5 }] });
    expect(request.status).toBe(201);

    const done = await owner.patch(`/branches/${branch.id}/deactivate`);
    expect(done.status).toBe(200);
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).isActive).toBe(
      false,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: pegawai.user.id } });
    expect(user.branchId).toBeNull();
    const cancelled = await prisma.stockTransfer.findUniqueOrThrow({
      where: { id: request.body.data.id },
    });
    expect(cancelled.status).toBe("DIBATALKAN");
  });

  it("10. menonaktifkan gudang utama ditolak", async () => {
    const owner = await loginSeed.owner();
    const gdg = await mainBranchId();
    const res = await owner.patch(`/branches/${gdg}/deactivate`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MAIN_BRANCH_PROTECTED");
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: gdg } })).isActive).toBe(true);
  });

  it("11. user dinonaktifkan saat sedang login → request berikutnya 401", async () => {
    const owner = await loginSeed.owner();
    const branch = await createBranch(owner);
    const pegawai = await createPegawai(owner, branch.id);
    expect((await pegawai.get("/auth/me")).status).toBe(200);

    const off = await owner.patch(`/users/${pegawai.user.id}/deactivate`);
    expect(off.status).toBe(200);
    expect((await pegawai.get("/auth/me")).status).toBe(401);
    expect((await pegawai.get("/stocks")).status).toBe(401);

    // Login ulang juga ditolak.
    const { email } = await prisma.user.findUniqueOrThrow({ where: { id: pegawai.user.id } });
    const again = await anonymous().post("/api/auth/login").send({ email, password: "rahasia123" });
    expect(again.status).toBe(401);
    expect(again.body.error.message).toMatch(/dinonaktifkan/);
  });

  it("12. hapus produk yang sudah punya movement → 409; produk tanpa riwayat boleh dihapus", async () => {
    const owner = await loginSeed.owner();
    const admin = await loginSeed.adminGudang();
    const used = await createProduct(owner);
    await stockIn(admin, [{ productId: used, qty: 5 }]);

    const blocked = await admin.delete(`/products/${used}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("PRODUCT_HAS_MOVEMENTS");
    expect(await prisma.product.count({ where: { id: used } })).toBe(1);

    const fresh = await createProduct(owner);
    const ok = await admin.delete(`/products/${fresh}`);
    expect([200, 204]).toContain(ok.status);
    expect(await prisma.product.count({ where: { id: fresh } })).toBe(0);
  });

  it("13. Pegawai Cabang yang mengirim branchId cabang lain tetap hanya mendapat data cabangnya", async () => {
    const admin = await loginSeed.adminGudang();
    const owner = await loginSeed.owner();
    const cb01 = await loginSeed.pegawaiCb01();
    const cb02 = await loginSeed.pegawaiCb02();
    const own = cb01.user.branch!.id;
    const other = cb02.user.branch!.id;
    const gdg = await mainBranchId();

    // Pastikan ada data di CB01, CB02, dan gudang.
    const productId = await createProduct(owner, { minStock: 1 });
    await stockIn(admin, [{ productId, qty: 20 }]);
    for (const pegawai of [cb01, cb02]) {
      const sent = await admin.post("/transfers/direct", {
        toBranchId: pegawai.user.branch!.id,
        items: [{ productId, qty: 3 }],
      });
      await pegawai.post(`/transfers/${sent.body.data.id}/receive`);
    }

    type WithBranch = { branch: { id: number } };
    for (const forged of [other, gdg]) {
      const stocks = await cb01.get(`/stocks?branchId=${forged}&pageSize=100`);
      expect(stocks.status).toBe(200);
      expect(stocks.body.data.length).toBeGreaterThan(0);
      expect(stocks.body.data.every((r: WithBranch) => r.branch.id === own)).toBe(true);

      const movements = await cb01.get(`/movements?branchId=${forged}&pageSize=100`);
      expect(movements.status).toBe(200);
      expect(movements.body.data.length).toBeGreaterThan(0);
      expect(movements.body.data.every((m: WithBranch) => m.branch.id === own)).toBe(true);

      const dashboard = await cb01.get(`/dashboard?branchId=${forged}`);
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.data.branch.id).toBe(own);
    }
  });

  it("14. menambah cabang kedua dengan is_main = true lewat SQL ditolak oleh database", async () => {
    const code = `X${uniq()}`.slice(0, 20);
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO branches (code, name, is_main, is_active, updated_at) VALUES ('${code}', 'Gudang Kedua', true, true, now())`,
      ),
    ).rejects.toThrow();
    expect(await prisma.branch.count({ where: { isMain: true } })).toBe(1);
    expect(await prisma.branch.count({ where: { code } })).toBe(0);
  });
});
