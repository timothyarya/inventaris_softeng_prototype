import type { Role } from "./auth";

export type PageMeta = { page: number; pageSize: number; total: number };
export type Paginated<T> = { data: T[]; meta: PageMeta };

export type BranchRef = { id: number; code: string; name: string; isMain: boolean };

export type Branch = BranchRef & {
  address: string | null;
  phone: string | null;
  isActive: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BranchDetail = Branch & {
  users: { id: number; name: string; email: string; isActive: boolean }[];
  stockSummary: {
    activeProducts: number;
    productsInStock: number;
    totalQty: number;
    lowStock: number;
  };
};

export type DeactivatedBranch = Branch & {
  effects: { usersReleased: number; transfersCancelled: number; opnamesRejected: number };
};

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  branchId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch: BranchRef | null;
};

export type Category = { id: number; name: string; productCount: number };

export type Product = {
  id: number;
  sku: string;
  name: string;
  categoryId: number | null;
  category: { id: number; name: string } | null;
  unit: string;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockRow = {
  branch: BranchRef & { isActive: boolean };
  product: {
    id: number;
    sku: string;
    name: string;
    unit: string;
    minStock: number;
    isActive: boolean;
    category: string | null;
  };
  qty: number;
  isLow: boolean;
};

export type StockInSummary = {
  id: number;
  docNo: string;
  /** YYYY-MM-DD */
  date: string;
  supplierName: string;
  invoiceNo: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { id: number; name: string };
  itemCount: number;
  totalQty: number;
};

export type StockInDetail = StockInSummary & {
  items: {
    id: number;
    qty: number;
    product: { id: number; sku: string; name: string; unit: string };
  }[];
};

export type TransferStatus =
  "DIAJUKAN" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN" | "DIKIRIM" | "DITERIMA";

export type TransferOrigin = "REQUEST" | "DIRECT";

export type TransferSummary = {
  id: number;
  docNo: string;
  status: TransferStatus;
  origin: TransferOrigin;
  fromBranch: BranchRef;
  toBranch: BranchRef;
  note: string | null;
  createdAt: string;
  requestedAt: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  itemCount: number;
  /** null pada pengiriman langsung / belum dikirim / belum diterima. */
  totalRequested: number | null;
  totalSent: number | null;
  totalReceived: number | null;
};

type UserRef = { id: number; name: string };

export type TransferItem = {
  id: number;
  product: { id: number; sku: string; name: string; unit: string; isActive: boolean };
  qtyRequested: number | null;
  qtyApproved: number | null;
  qtySent: number | null;
  qtyReceived: number | null;
  /** qtySent − qtyReceived; null sebelum diterima. */
  shortfall: number | null;
  /** Hanya untuk Owner/Admin Cabang pada status DIAJUKAN/DISETUJUI. */
  warehouseStock?: number;
};

export type TransferDetail = TransferSummary & {
  rejectReason: string | null;
  cancelReason: string | null;
  requestedBy: UserRef | null;
  approvedBy: UserRef | null;
  approvedAt: string | null;
  sentBy: UserRef | null;
  receivedBy: UserRef | null;
  items: TransferItem[];
};
