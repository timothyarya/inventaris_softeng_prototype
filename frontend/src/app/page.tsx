"use client";

import { useEffect, useState } from "react";

type HealthState =
  { status: "loading" } | { status: "ok"; time: string } | { status: "error"; message: string };

// Halaman sementara Fase 0: membuktikan FE -> rewrite /api/* -> Express -> database.
// Akan diganti oleh alur login/redirect di Fase 1.
export default function Home() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { status: string; time: string };
        setHealth({ status: "ok", time: data.time });
      })
      .catch((err: unknown) =>
        setHealth({ status: "error", message: err instanceof Error ? err.message : "Gagal" }),
      );
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Sistem Inventaris Multi Cabang</h1>
      <p className="text-muted-foreground">Fase 0 — setup</p>
      <p className="rounded-md border px-4 py-2 text-sm">
        {health.status === "loading" && "Memeriksa backend…"}
        {health.status === "ok" && `Backend & database terhubung (${health.time})`}
        {health.status === "error" && `Backend tidak dapat dijangkau: ${health.message}`}
      </p>
    </main>
  );
}
