"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { ActiveBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useActiveBranches } from "@/hooks/use-branches";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useUsers } from "@/hooks/use-users";
import { ROLE_LABEL, type Role } from "@/lib/auth";
import { formatBranch } from "@/lib/format";
import type { ManagedUser } from "@/lib/types";

const NONE = "none";

const columns: Column<ManagedUser>[] = [
  {
    header: "Nama",
    cell: (u) => (
      <Link href={`/users/${u.id}`} className="font-medium hover:underline">
        {u.name}
      </Link>
    ),
  },
  { header: "Email", cell: (u) => u.email },
  { header: "Role", cell: (u) => ROLE_LABEL[u.role] },
  {
    header: "Cabang",
    cell: (u) => {
      if (u.branch) return formatBranch(u.branch);
      if (u.role === "PEGAWAI_CABANG") return <Badge variant="secondary">Menunggu penugasan</Badge>;
      return "—";
    },
  },
  { header: "Status", cell: (u) => <ActiveBadge active={u.isActive} /> },
];

export function UserList() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | Role>("");
  const [branch, setBranch] = useState(""); // "", "none", atau id cabang
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const branches = useActiveBranches();

  // "Pegawai Cabang tanpa cabang" hanya bermakna untuk role Pegawai Cabang, jadi role ikut dipaksa.
  const awaiting = branch === NONE;
  const query = useUsers({
    page,
    pageSize: 20,
    q: q || undefined,
    role: awaiting ? "PEGAWAI_CABANG" : role || undefined,
    branchId: awaiting ? NONE : branch ? Number(branch) : undefined,
    status: status || undefined,
  });

  const reset = () => setPage(1);

  return (
    <div className="space-y-4">
      <PageHeader
        title="User"
        description="Kelola akun Owner, Admin Cabang, dan Pegawai Cabang."
        actions={
          <Button render={<Link href="/users/baru" />} nativeButton={false}>
            <Plus />
            Tambah User
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
            placeholder="Cari nama atau email…"
            className="pl-8"
            aria-label="Cari user"
          />
        </div>
        <NativeSelect
          value={awaiting ? "PEGAWAI_CABANG" : role}
          disabled={awaiting}
          onChange={(e) => {
            setRole(e.target.value as "" | Role);
            reset();
          }}
          aria-label="Filter role"
        >
          <NativeSelectOption value="">Semua role</NativeSelectOption>
          <NativeSelectOption value="OWNER">{ROLE_LABEL.OWNER}</NativeSelectOption>
          <NativeSelectOption value="ADMIN_CABANG">{ROLE_LABEL.ADMIN_CABANG}</NativeSelectOption>
          <NativeSelectOption value="PEGAWAI_CABANG">
            {ROLE_LABEL.PEGAWAI_CABANG}
          </NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            reset();
          }}
          aria-label="Filter cabang"
        >
          <NativeSelectOption value="">Semua cabang</NativeSelectOption>
          <NativeSelectOption value={NONE}>Pegawai Cabang tanpa cabang</NativeSelectOption>
          {branches.data?.data.map((b) => (
            <NativeSelectOption key={b.id} value={String(b.id)}>
              {formatBranch(b)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | "active" | "inactive");
            reset();
          }}
          aria-label="Filter status"
        >
          <NativeSelectOption value="">Semua status</NativeSelectOption>
          <NativeSelectOption value="active">Aktif</NativeSelectOption>
          <NativeSelectOption value="inactive">Nonaktif</NativeSelectOption>
        </NativeSelect>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onPageChange={setPage}
        rowKey={(u) => u.id}
        emptyTitle="Tidak ada user"
        emptyDescription="Ubah kata kunci atau filter pencarian."
      />
    </div>
  );
}
