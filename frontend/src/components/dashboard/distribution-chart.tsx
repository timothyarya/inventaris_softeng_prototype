"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBranch, formatDate, formatNumber } from "@/lib/format";
import type { DashboardAdmin } from "@/lib/types";

type Distribution = DashboardAdmin["distribution"];

type Datum = { code: string; label: string; qtySent: number };

/** Kotak tooltip: nama cabang lengkap dan jumlah unit, memakai token tema aplikasi. */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{datum.label}</p>
      <p className="text-muted-foreground">{formatNumber(datum.qtySent)} unit dikirim</p>
    </div>
  );
}

/**
 * Distribusi 30 hari terakhir (bagian 4.9): satu seri, jumlah unit yang dikirim per cabang tujuan.
 * Satu seri → tanpa legenda (judul kartu yang menamainya). Tersedia tampilan tabel sebagai
 * alternatif yang dapat dibaca pembaca layar.
 */
export function DistributionChart({ distribution }: { distribution: Distribution }) {
  const [asTable, setAsTable] = useState(false);
  const data: Datum[] = distribution.items.map((i) => ({
    code: i.branch.code,
    label: formatBranch(i.branch),
    qtySent: i.qtySent,
  }));
  const total = data.reduce((sum, d) => sum + d.qtySent, 0);
  const period = `${formatDate(distribution.from)} – ${formatDate(distribution.to)}`;

  return (
    <Card data-testid="dashboard-distribution">
      <CardHeader>
        <CardTitle>Distribusi ke cabang, 30 hari terakhir</CardTitle>
        <CardDescription>
          Jumlah unit yang dikirim per cabang tujuan · {period} ·{" "}
          <span data-testid="distribution-total">{formatNumber(total)} unit</span>
        </CardDescription>
        {data.length > 0 && total > 0 && (
          <div className="col-start-1 row-start-3 pt-1">
            <Button variant="outline" size="sm" onClick={() => setAsTable((v) => !v)}>
              {asTable ? "Lihat grafik" : "Lihat tabel"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 || total === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Belum ada pengiriman dalam 30 hari terakhir.
          </p>
        ) : asTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabang tujuan</TableHead>
                <TableHead className="text-right">Unit dikirim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.code}>
                  <TableCell>{d.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(d.qtySent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div
            className="h-64 w-full"
            role="img"
            aria-label={`Grafik batang unit dikirim per cabang tujuan, 30 hari terakhir. ${data
              .map((d) => `${d.label}: ${formatNumber(d.qtySent)} unit`)
              .join("; ")}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="code"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                />
                <Bar
                  dataKey="qtySent"
                  name="Unit dikirim"
                  fill="var(--chart-series)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
