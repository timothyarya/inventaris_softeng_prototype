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
    outOfStock: number;
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

/** AMAN, MENIPIS (0 < qty < stok min.), HABIS (qty 0). Produk nonaktif selalu AMAN. */
export type StockStatus = "AMAN" | "MENIPIS" | "HABIS";

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
  status: StockStatus;
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
  /** Hanya untuk Owner/Admin Gudang pada status DIAJUKAN/DISETUJUI. */
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

export type OpnameStatus = "MENUNGGU" | "DISETUJUI" | "DITOLAK";

export type OpnameUser = { id: number; name: string; role: Role };

export type OpnameSummary = {
  id: number;
  docNo: string;
  branch: BranchRef;
  /** Tanggal penghitungan, YYYY-MM-DD */
  date: string;
  status: OpnameStatus;
  note: string | null;
  createdBy: OpnameUser;
  createdAt: string;
  verifiedBy: OpnameUser | null;
  verifiedAt: string | null;
  itemCount: number;
  /** Jumlah item yang selisihnya bukan 0. */
  diffItemCount: number;
  totalDifference: number;
};

export type OpnameItem = {
  id: number;
  product: { id: number; sku: string; name: string; unit: string; isActive: boolean };
  qtySystem: number;
  qtyPhysical: number;
  difference: number;
  remark: string | null;
};

export type OpnameDetail = OpnameSummary & {
  verifyNote: string | null;
  /** Role yang berhak memverifikasi (menurut role pembuat). */
  verifierRoles: Role[];
  /** Apakah pengguna yang login boleh menyetujui/menolak opname ini sekarang. */
  canVerify: boolean;
  items: OpnameItem[];
};

export type OpnamePrefill = {
  branch: BranchRef;
  pendingOpname: { id: number; docNo: string } | null;
  items: {
    product: {
      id: number;
      sku: string;
      name: string;
      unit: string;
      category: { id: number; name: string } | null;
    };
    qtySystem: number;
  }[];
};

export type MovementType = "MASUK" | "TRANSFER_OUT" | "TRANSFER_IN" | "OPNAME";
export type MovementRefType = "STOCK_IN" | "TRANSFER" | "OPNAME";

export type Movement = {
  id: number;
  createdAt: string;
  branch: BranchRef;
  product: { id: number; sku: string; name: string; unit: string; isActive: boolean };
  type: MovementType;
  /** Bertanda: positif menambah, negatif mengurangi. */
  qty: number;
  balanceAfter: number;
  refType: MovementRefType;
  refId: number;
  refDocNo: string;
  user: { id: number; name: string };
};

export type DashboardProblemItem = {
  branch: BranchRef;
  product: { id: number; sku: string; name: string; unit: string; minStock: number };
  qty: number;
  status: StockStatus;
};

export type DashboardAdmin = {
  scope: "ADMIN";
  /** Cabang yang dipilih pada filter; null = semua cabang. */
  branch: BranchRef | null;
  cards: {
    activeProducts: number;
    activeBranches: number;
    lowStock: number;
    outOfStock: number;
    pendingRequests: number;
    readyToSend: number;
    pendingOpnames: number;
  };
  lowStockItems: DashboardProblemItem[];
  distribution: {
    /** Batas jendela 30 hari, YYYY-MM-DD (hari Asia/Jakarta). */
    from: string;
    to: string;
    items: { branch: BranchRef; qtySent: number }[];
  };
  recentMovements: Movement[];
};

export type DashboardPegawai = {
  scope: "PEGAWAI";
  branch: BranchRef;
  cards: {
    activeProducts: number;
    lowStock: number;
    outOfStock: number;
    ongoingRequests: number;
    incomingToConfirm: number;
  };
  lowStockItems: DashboardProblemItem[];
  lastOpname: {
    id: number;
    docNo: string;
    date: string;
    status: OpnameStatus;
    verifyNote: string | null;
  } | null;
  recentMovements: Movement[];
};

export type Dashboard = DashboardAdmin | DashboardPegawai;
