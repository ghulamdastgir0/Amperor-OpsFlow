import Link from "next/link";
import { Clock } from "lucide-react";
import type { FinanceReservation } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { currency } from "@/lib/statusDisplay";

export function PendingProofList({ reservations }: { reservations: FinanceReservation[] }) {
  if (reservations.length === 0) return null;

  return (
    <Card>
      <h2 className="font-heading mb-1 text-sm font-semibold text-foreground">Awaiting Proof</h2>
      <p className="mb-4 text-xs text-muted">
        Approved on a stated (unverified) amount — attach a receipt/invoice on each request to move it
        from reserved to spent.
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {reservations.map((r) => (
          <li key={r.requestId}>
            <Link
              href={`/requests/${r.requestId}`}
              className="flex items-center gap-3 py-2.5 text-sm hover:opacity-80"
            >
              <Clock className="size-4 shrink-0 text-amber-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-foreground">{r.requesterName}</span>
              <span className="shrink-0 text-xs text-muted">{r.department}</span>
              <span className="shrink-0 font-medium text-amber-600">{currency(r.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
