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
import { Textarea } from "@/components/ui/textarea";

const MAX_REASON = 1000;

type RejectTexts = {
  /** Judul dialog. */
  title?: string;
  /** Penjelasan di bawah judul. */
  description?: React.ReactNode;
  /** Label kolom isian. */
  label?: string;
  /** Pesan bila isian kosong. */
  requiredMessage?: string;
  /** Teks tombol konfirmasi. */
  confirmLabel?: string;
};

/**
 * Dialog penolakan: catatan/alasan wajib diisi (bagian 4.4 dan 4.6).
 * Teks bawaan untuk request transfer; dokumen lain mengganti lewat props.
 */
export function RejectDialog({
  open,
  onOpenChange,
  docNo,
  pending,
  onSubmit,
  ...texts
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docNo: string;
  pending: boolean;
  onSubmit: (reason: string) => void;
} & RejectTexts) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      {open && (
        <RejectBody
          docNo={docNo}
          pending={pending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          {...texts}
        />
      )}
    </Dialog>
  );
}

function RejectBody({
  docNo,
  pending,
  onSubmit,
  onCancel,
  title = "Tolak request?",
  description,
  label = "Alasan penolakan",
  requiredMessage = "Alasan penolakan wajib diisi",
  confirmLabel = "Tolak",
}: {
  docNo: string;
  pending: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
} & RejectTexts) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const error =
    trimmed === ""
      ? requiredMessage
      : trimmed.length > MAX_REASON
        ? `Maksimal ${MAX_REASON} karakter`
        : null;

  return (
    <DialogContent>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (error || pending) return;
          onSubmit(trimmed);
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription render={<div />}>
            {description ?? (
              <>
                Request <span className="font-mono">{docNo}</span> akan ditolak dan tidak dapat
                diproses lagi. Pegawai Cabang dapat melihat alasannya.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            {label}
          </label>
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && error ? true : undefined}
          />
          {touched && error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
