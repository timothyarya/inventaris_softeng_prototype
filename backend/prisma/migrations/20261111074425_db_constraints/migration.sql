-- Hanya boleh ada satu gudang utama
CREATE UNIQUE INDEX branches_single_main ON branches (is_main) WHERE is_main = true;

-- Stok tidak boleh negatif (lapis kedua setelah validasi di stockService)
ALTER TABLE branch_stocks ADD CONSTRAINT branch_stocks_qty_nonneg CHECK (qty >= 0);

-- Qty item harus masuk akal
ALTER TABLE stock_in_items ADD CONSTRAINT stock_in_items_qty_pos CHECK (qty > 0);
ALTER TABLE stock_transfer_items ADD CONSTRAINT transfer_items_qty_nonneg CHECK (
  (qty_requested IS NULL OR qty_requested >= 0) AND
  (qty_approved IS NULL OR qty_approved >= 0) AND
  (qty_sent IS NULL OR qty_sent >= 0) AND
  (qty_received IS NULL OR (qty_received >= 0 AND qty_sent IS NOT NULL AND qty_received <= qty_sent))
);
ALTER TABLE stock_opname_items ADD CONSTRAINT opname_items_qty_nonneg CHECK (qty_physical >= 0 AND qty_system >= 0);

-- Transfer tidak boleh ke cabang asal sendiri
ALTER TABLE stock_transfers ADD CONSTRAINT transfers_diff_branch CHECK (from_branch_id <> to_branch_id);

-- Hanya satu opname MENUNGGU per cabang
CREATE UNIQUE INDEX stock_opnames_one_pending ON stock_opnames (branch_id) WHERE status = 'MENUNGGU';
