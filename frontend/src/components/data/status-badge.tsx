import { Badge } from "@/components/ui/badge";

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge
      variant="secondary"
      className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    >
      Aktif
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    >
      Nonaktif
    </Badge>
  );
}
