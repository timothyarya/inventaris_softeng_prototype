import { describe, expect, it } from "vitest";
import { createProduct, stockIn, today } from "./helpers/fixtures";
import { loginSeed } from "./helpers/session";

// Skenario uji wajib 15: nomor dokumen dibuat atomik (bagian 4.10).
describe("nomor dokumen", () => {
  it("15. request stok masuk bersamaan pada hari yang sama → nomor berbeda dan berurutan", async () => {
    const owner = await loginSeed.owner();
    const admin = await loginSeed.adminGudang();
    const productId = await createProduct(owner);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => stockIn(admin, [{ productId, qty: 1 }])),
    );
    const compact = today().replaceAll("-", "");
    const sequences = results.map((r) => {
      const match = /^SI-(\d{8})-(\d{4})$/.exec(r.docNo);
      expect(match, r.docNo).not.toBeNull();
      expect(match![1]).toBe(compact);
      return Number(match![2]);
    });

    expect(new Set(results.map((r) => r.docNo)).size).toBe(6);
    sequences.sort((a, b) => a - b);
    // Berurutan tanpa celah dan tanpa duplikat.
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBe(sequences[i - 1]! + 1);
    }
  });
});
