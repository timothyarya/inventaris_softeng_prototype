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
