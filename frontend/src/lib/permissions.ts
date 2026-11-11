import {
  Boxes,
  Building2,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  PackagePlus,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./auth";

// Catatan: ini hanya untuk UX. Backend adalah sumber kebenaran akses (bagian 3.3).

export type MenuLeaf = { label: string; href: string };
export type MenuItem = {
  label: string;
  icon: LucideIcon;
  /** Menu tunggal (tanpa submenu). */
  href?: string;
  /** Submenu. */
  children?: MenuLeaf[];
};

const DASHBOARD: MenuItem = { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" };
const OPNAME: MenuItem = { label: "Stok Opname", icon: ClipboardCheck, href: "/opname" };
const RIWAYAT: MenuItem = { label: "Riwayat Stok", icon: History, href: "/riwayat" };

const ADMIN_MENU_BEFORE_MASTER: MenuItem[] = [
  DASHBOARD,
  {
    label: "Produk",
    icon: Package,
    children: [
      { label: "Produk", href: "/produk" },
      { label: "Kategori", href: "/kategori" },
    ],
  },
  { label: "Stok Cabang", icon: Warehouse, href: "/stok" },
];

const ADMIN_MENU_AFTER_MASTER: MenuItem[] = [
  { label: "Stok Masuk", icon: PackagePlus, href: "/stok-masuk" },
  {
    label: "Transfer Stok",
    icon: Truck,
    children: [
      { label: "Semua Pengajuan", href: "/transfer" },
      { label: "Form Pengiriman", href: "/transfer/kirim" },
    ],
  },
  OPNAME,
  RIWAYAT,
  {
    label: "Laporan",
    icon: ChartColumn,
    children: [
      { label: "Stok", href: "/laporan/stok" },
      { label: "Distribusi", href: "/laporan/distribusi" },
    ],
  },
];

const MENUS: Record<Role, MenuItem[]> = {
  // Bagian 8 + keputusan 14: "Stok Cabang" tepat setelah Produk.
  OWNER: [
    ...ADMIN_MENU_BEFORE_MASTER,
    { label: "Cabang", icon: Building2, href: "/cabang" },
    { label: "User", icon: Users, href: "/users" },
    ...ADMIN_MENU_AFTER_MASTER,
  ],
  ADMIN_GUDANG: [...ADMIN_MENU_BEFORE_MASTER, ...ADMIN_MENU_AFTER_MASTER],
  PEGAWAI_CABANG: [
    DASHBOARD,
    { label: "Inventaris", icon: Boxes, href: "/inventaris" },
    {
      label: "Request Stok",
      icon: ClipboardList,
      children: [
        { label: "Buat Request", href: "/request-stok/baru" },
        { label: "Request Saya", href: "/request-stok" },
        { label: "Kiriman Masuk", href: "/request-stok?tab=masuk" },
      ],
    },
    OPNAME,
    RIWAYAT,
  ],
};

export function getMenu(role: Role): MenuItem[] {
  return MENUS[role];
}

const ADMIN: Role[] = ["OWNER", "ADMIN_GUDANG"];

/** Aturan akses route (bagian 9). Prefiks terpanjang yang cocok yang berlaku. */
const ROUTE_RULES: { path: string; exact?: boolean; roles: Role[] | "all" }[] = [
  { path: "/dashboard", roles: "all" },
  { path: "/403", roles: "all" },
  { path: "/produk", roles: ADMIN },
  { path: "/kategori", roles: ADMIN },
  { path: "/inventaris", roles: ["PEGAWAI_CABANG"] },
  { path: "/stok", exact: true, roles: ADMIN },
  { path: "/cabang", roles: ["OWNER"] },
  { path: "/users", roles: ["OWNER"] },
  { path: "/stok-masuk", roles: ADMIN },
  { path: "/transfer", exact: true, roles: ADMIN },
  { path: "/transfer/kirim", roles: ADMIN },
  { path: "/transfer", roles: "all" }, // /transfer/[id]: semua role (dibatasi cabang di backend)
  { path: "/request-stok", roles: ["PEGAWAI_CABANG"] },
  { path: "/opname", roles: "all" },
  { path: "/riwayat", roles: "all" },
  { path: "/laporan", roles: ADMIN },
];

function matches(rule: (typeof ROUTE_RULES)[number], pathname: string): boolean {
  return rule.exact
    ? pathname === rule.path
    : pathname === rule.path || pathname.startsWith(`${rule.path}/`);
}

/** Apakah role boleh membuka route ini. Route yang tidak dikenal dibiarkan (Next.js yang 404). */
export function canAccess(role: Role, pathname: string): boolean {
  const matched = ROUTE_RULES.filter((r) => matches(r, pathname)).sort((a, b) => {
    if (a.path.length !== b.path.length) return b.path.length - a.path.length;
    return Number(Boolean(b.exact)) - Number(Boolean(a.exact));
  })[0];
  if (!matched) return true;
  return matched.roles === "all" || matched.roles.includes(role);
}

/**
 * Menentukan href menu mana yang aktif untuk URL saat ini. Path terpanjang menang,
 * dan href ber-query (mis. ?tab=masuk) hanya cocok bila query-nya sama.
 */
export function findActiveHref(
  menu: MenuItem[],
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  const hrefs = menu.flatMap((m) => (m.href ? [m.href] : (m.children ?? []).map((c) => c.href)));
  let best: { href: string; score: number } | null = null;

  for (const href of hrefs) {
    const [path, query] = href.split("?");
    if (!(pathname === path || pathname.startsWith(`${path}/`))) continue;
    if (query) {
      const wanted = new URLSearchParams(query);
      const ok = [...wanted].every(([k, v]) => searchParams.get(k) === v);
      if (!ok) continue;
    }
    const score = path.length * 10 + (query ? 1 : 0);
    if (!best || score > best.score) best = { href, score };
  }
  return best?.href ?? null;
}
