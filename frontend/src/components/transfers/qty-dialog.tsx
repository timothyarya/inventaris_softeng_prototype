"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_ITEM_QTY } from "@/components/stock-ins/stock-in-schema";
import { formatNumber } from "@/lib/format";

export type QtyRow = {
  itemId: number;
  label: string;
  unit: string;
  /** Nilai awal kolom. */
  initial: number;
  /** Batas atas (mis. qty dikirim saat menerima). */
  max?: number;
  /** Keterangan kecil di bawah nama produk (mis. stok gudang). */
  hint?: string;
  /** Peringatan bila nilai melebihi batas lunak ini (mis. stok gudang). */
  warnAbove?: number;
};

/**
 * Dialog berisi satu kolom qty per item, dipakai untuk setujui / kirim / terima.
 * Dirender hanya saat `open` agar nilai awal selalu dibaca ulang dari data terbaru.
 */
export function QtyDialog({
  open,
  onOpenChange,
  title,
  description,
  qtyLabel,
  rows,
  confirmLabel,
  pending,
  requirePositive,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  qtyLabel: string;
  rows: QtyRow[];
  confirmLabel: string;
  pending: boolean;
  /** Setujui dan kirim butuh minimal satu item dengan qty > 0 (terima boleh semuanya 0). */
  requirePositive: boolean;
  onSubmit: (values: { itemId: number; qty: number }[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      {open && (
        <QtyDialogBody
          title={title}
          description={description}
          qtyLabel={qtyLabel}
          rows={rows}
          confirmLabel={confirmLabel}
          pending={pending}
          requirePositive={requirePositive}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function QtyDialogBody({
  title,
  description,
  qtyLabel,
  rows,
  confirmLabel,
  pending,
  requirePositive,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  qtyLabel: string;
  rows: QtyRow[];
  confirmLabel: string;
  pending: boolean;
  requirePositive: boolean;
  onSubmit: (values: { itemId: number; qty: number }[]) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.itemId, String(r.initial)])),
  );

  const parsed = rows.map((row) => {
    const text = values[row.itemId] ?? "";
    const n = Number(text);
    const max = Math.min(row.max ?? MAX_ITEM_QTY, MAX_ITEM_QTY);
    let error: string | null = null;
    if (text.trim() === "" || !Number.isFinite(n)) error = "Isi dengan angka";
    else if (!Number.isInteger(n)) error = "Harus bilangan bulat";
    else if (n < 0) error = "Tidak boleh negatif";
    else if (n > max) error = `Maksimal ${formatNumber(max)}`;
    return { row, n, error };
  });
  const anyError = parsed.some((p) => p.error);
  const noPositive = requirePositive && !parsed.some((p) => !p.error && p.n > 0);
  const invalid = anyError || noPositive;

  return (
    <DialogContent className="sm:max-w-xl">
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid || pending) return;
          onSubmit(parsed.map((p) => ({ itemId: p.row.itemId, qty: p.n })));
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription render={<div />}>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {parsed.map(({ row, n, error }, index) => {
            const warn =
              !error && row.warnAbove !== undefined && n > row.warnAbove
                ? `Melebihi stok gudang (${formatNumber(row.warnAbove)})`
                : null;
            return (
              <div key={row.itemId} className="grid grid-cols-[1fr_8rem] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  {row.hint && <p className="text-muted-foreground text-xs">{row.hint}</p>}
                  {warn && <p className="text-destructive text-xs font-medium">{warn}</p>}
                  {error && <p className="text-destructive text-xs">{error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    aria-label={`${qtyLabel} item ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    value={values[row.itemId] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [row.itemId]: e.target.value }))
                    }
                  />
                  <span className="text-muted-foreground w-9 text-sm">{row.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {noPositive && !anyError && (
          <p className="text-destructive text-sm">Minimal satu item harus lebih dari 0.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" disabled={invalid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
