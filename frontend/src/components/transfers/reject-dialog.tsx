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

/** Dialog penolakan: alasan wajib diisi (bagian 4.4). */
export function RejectDialog({
  open,
  onOpenChange,
  docNo,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docNo: string;
  pending: boolean;
  onSubmit: (reason: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      {open && (
        <RejectBody
          docNo={docNo}
          pending={pending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
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
}: {
  docNo: string;
  pending: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const error =
    trimmed === ""
      ? "Alasan penolakan wajib diisi"
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
          <DialogTitle>Tolak request?</DialogTitle>
          <DialogDescription render={<div />}>
            Request <span className="font-mono">{docNo}</span> akan ditolak dan tidak dapat diproses
            lagi. Pegawai cabang dapat melihat alasannya.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            Alasan penolakan
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
            Tolak
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
