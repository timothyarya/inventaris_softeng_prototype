import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma";
import {
  createProduct,
  mainBranchId,
  movementsOf,
  qtyOf,
  requestApproveSend,
  stockIn,
  today,
} from "./helpers/fixtures";
import { loginSeed, type Session } from "./helpers/session";

// Skenario uji wajib 1–8 (INSTRUCTION.md bagian 12, Fase 9): stok masuk, alur transfer penuh,
// kirim melebihi stok, kirim bersamaan, scoping cabang, dan opname.
describe("alur stok gudang → cabang", () => {
  let owner: Session;
  let admin: Session;
  let cb01: Session;
  let cb02: Session;
  let gdg: number;
  let cb01Id: number;
  let productId: number;
  let transferId: number;
  let itemId: number;

  beforeAll(async () => {
    [owner, admin, cb01, cb02] = await Promise.all([
      loginSeed.owner(),
      loginSeed.adminGudang(),
      loginSeed.pegawaiCb01(),
      loginSeed.pegawaiCb02(),
    ]);
    gdg = await mainBranchId();
    cb01Id = cb01.user.branch!.id;
    productId = await createProduct(owner, { minStock: 10 });
  });

  it("1. stok masuk 100 ke gudang → stok gudang 100 dan 1 movement MASUK", async () => {
    await stockIn(admin, [{ productId, qty: 100 }]);

    expect(await qtyOf(gdg, productId)).toBe(100);
    const movements = await movementsOf(productId);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "MASUK",
      qty: 100,
      balanceAfter: 100,
      branchId: gdg,
    });
  });

  it("2. request 30 → disetujui → dikirim: gudang 70, TRANSFER_OUT −30, stok CB01 belum berubah", async () => {
    const { id, sent } = await requestApproveSend({
      pegawai: cb01,
      admin,
      items: [{ productId, qty: 30 }],
    });
    expect(sent.status).toBe(200);
    transferId = id;

    expect(await qtyOf(gdg, productId)).toBe(70);
    expect(await qtyOf(cb01Id, productId)).toBe(0);
    const out = (await movementsOf(productId)).filter((m) => m.type === "TRANSFER_OUT");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ qty: -30, branchId: gdg, balanceAfter: 70 });

    const detail = await admin.get(`/transfers/${transferId}`);
    expect(detail.body.data.status).toBe("DIKIRIM");
    itemId = detail.body.data.items[0].id;
  });

  it("6. Pegawai CB02 tidak dapat melihat atau menerima transfer CB01", async () => {
    const view = await cb02.get(`/transfers/${transferId}`);
    expect([403, 404]).toContain(view.status);

    const receive = await cb02.post(`/transfers/${transferId}/receive`, {
      items: [{ itemId, qtyReceived: 30 }],
    });
    expect([403, 404]).toContain(receive.status);
    expect(await qtyOf(cb01Id, productId)).toBe(0);
  });

  it("3. CB01 menerima 28 → stok CB01 28, TRANSFER_IN +28; selisih 2 tampil di laporan dan bukan movement", async () => {
    const res = await cb01.post(`/transfers/${transferId}/receive`, {
      items: [{ itemId, qtyReceived: 28 }],
    });
    expect(res.status).toBe(200);

    expect(await qtyOf(cb01Id, productId)).toBe(28);
    const movements = await movementsOf(productId);
    expect(movements.filter((m) => m.type === "TRANSFER_IN")).toEqual([
      expect.objectContaining({ qty: 28, branchId: cb01Id, balanceAfter: 28 }),
    ]);
    // Hanya MASUK, TRANSFER_OUT, dan TRANSFER_IN: selisih kirim tidak membuat movement.
    expect(movements.map((m) => m.type)).toEqual(["MASUK", "TRANSFER_OUT", "TRANSFER_IN"]);

    const detail = await admin.get(`/transfers/${transferId}`);
    expect(detail.body.data.items[0].shortfall).toBe(2);

    const report = await owner.get(
      `/reports/distribution?branchId=${cb01Id}&from=${today()}&to=${today()}`,
    );
    expect(report.status).toBe(200);
    const row = report.body.data.rows.find((r: { origin: string }) => r.origin === "REQUEST");
    const item = row.items.find((i: { product: { id: number } }) => i.product.id === productId);
    expect(item).toMatchObject({ qtySent: 30, qtyReceived: 28, shortfall: 2 });
  });

  it("4. kirim melebihi stok gudang → 422 dan tidak ada perubahan apa pun", async () => {
    // Gudang tersisa 70; request 80 disetujui lalu dikirim.
    const created = await cb01.post("/transfers/requests", { items: [{ productId, qty: 80 }] });
    const id = created.body.data.id as number;
    await admin.post(`/transfers/${id}/approve`);

    const before = {
      gdg: await qtyOf(gdg, productId),
      cb01: await qtyOf(cb01Id, productId),
      movements: (await movementsOf(productId)).length,
    };
    const sent = await admin.post(`/transfers/${id}/send`);
    expect(sent.status).toBe(422);

    expect(await qtyOf(gdg, productId)).toBe(before.gdg);
    expect(await qtyOf(cb01Id, productId)).toBe(before.cb01);
    expect((await movementsOf(productId)).length).toBe(before.movements);
    const detail = await admin.get(`/transfers/${id}`);
    expect(detail.body.data.status).toBe("DISETUJUI");
  });

  it("5. dua request kirim bersamaan untuk transfer yang sama → hanya satu berhasil", async () => {
    const stockBefore = await qtyOf(gdg, productId);
    const created = await cb01.post("/transfers/requests", { items: [{ productId, qty: 5 }] });
    const id = created.body.data.id as number;
    await admin.post(`/transfers/${id}/approve`);

    const [a, b] = await Promise.all([
      admin.post(`/transfers/${id}/send`),
      admin.post(`/transfers/${id}/send`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    // Stok gudang berkurang tepat sekali.
    expect(await qtyOf(gdg, productId)).toBe(stockBefore - 5);
    const out = await prisma.stockMovement.count({
      where: { productId, type: "TRANSFER_OUT", refId: id },
    });
    expect(out).toBe(1);
  });

  it("8. opname kedua saat masih ada yang MENUNGGU → 409", async () => {
    // Stok CB01 sekarang 28 (hanya 28 diterima dari transfer pertama).
    const first = await cb01.post("/opnames", { items: [{ productId, qtyPhysical: 25 }] });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe("MENUNGGU");
    const second = await cb01.post("/opnames", { items: [{ productId, qtyPhysical: 20 }] });
    expect(second.status).toBe(409);
  });

  it("7. opname qty fisik 25 (sistem 28) disetujui → CB01 25 dan movement OPNAME −3", async () => {
    const list = await cb01.get("/opnames?status=MENUNGGU");
    const opname = list.body.data[0];
    const detail = await cb01.get(`/opnames/${opname.id}`);
    expect(detail.body.data.items[0]).toMatchObject({ qtySystem: 28, qtyPhysical: 25 });

    const approve = await admin.post(`/opnames/${opname.id}/approve`);
    expect(approve.status).toBe(200);

    expect(await qtyOf(cb01Id, productId)).toBe(25);
    const movements = (await movementsOf(productId)).filter((m) => m.type === "OPNAME");
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ qty: -3, branchId: cb01Id, balanceAfter: 25 });
  });
});
