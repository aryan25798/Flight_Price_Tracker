"use client";

import * as React from "react";
import { Check, Loader2, Plane, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createTrackerAction, deleteTrackerAction } from "@/app/dashboard/actions";
import { adminActionDispatch } from "@/app/admin/actions";

export interface ActionProposal {
  type: "action_proposal";
  action: "create_tracker" | "delete_tracker" | "trigger_poll";
  requiresUserConfirmation: boolean;
  trackerId?: string;
  details: Record<string, unknown>;
  confirmationMessage: string;
}

export function AIActionCard({
  proposal,
  onResolved,
}: {
  proposal: ActionProposal;
  onResolved?: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-2.5 text-xs text-[var(--muted-foreground)] italic">
        Action proposal dismissed by user.
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
        <span className="font-semibold">Action successfully executed and recorded in database.</span>
      </div>
    );
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      if (proposal.action === "create_tracker") {
        const d = proposal.details as {
          origin: string;
          destination: string;
          departureDate: string;
          returnDate?: string | null;
          tripType: "one_way" | "round_trip";
          currency: string;
          targetPrice: number;
        };

        const res = await createTrackerAction({
          origin: d.origin,
          destination: d.destination,
          departureDate: d.departureDate,
          returnDate: d.returnDate,
          tripType: d.tripType,
          adults: 1,
          children: 0,
          infants: 0,
          cabinClass: "economy",
          currency: d.currency,
          targetPrice: d.targetPrice,
        });

        if (res.ok) {
          toast.success(res.message);
          setCompleted(true);
          onResolved?.();
        } else {
          toast.error(res.message);
        }
      } else if (proposal.action === "delete_tracker" && proposal.trackerId) {
        const res = await deleteTrackerAction(proposal.trackerId);
        if (res.ok) {
          toast.success(res.message);
          setCompleted(true);
          onResolved?.();
        } else {
          toast.error(res.message);
        }
      } else if (proposal.action === "trigger_poll") {
        const res = await adminActionDispatch({ action: "trigger_poll" });
        if (res.ok) {
          toast.success("Manual background polling cycle triggered!");
          setCompleted(true);
          onResolved?.();
        } else {
          toast.error(res.error || "Failed to trigger poll.");
        }
      }
    } catch (err) {
      toast.error("Failed to execute action.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-sky-500/30 glass-surface-2 p-3.5 space-y-3 text-xs shadow-lg animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
        <div className="flex items-center gap-1.5 font-bold text-sky-300">
          {proposal.action === "delete_tracker" ? (
            <Trash2 className="h-4 w-4 text-red-400" />
          ) : proposal.action === "trigger_poll" ? (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          ) : (
            <Plane className="h-4 w-4 text-sky-400" />
          )}
          <span>Action Confirmation Required</span>
        </div>
        <Badge variant={proposal.action === "delete_tracker" ? "destructive" : "warning"} className="text-[10px]">
          Pending Approval
        </Badge>
      </div>

      <p className="text-[var(--foreground)] font-medium leading-relaxed">
        {proposal.confirmationMessage}
      </p>

      {/* Proposal Details Table/Badges */}
      {proposal.action === "create_tracker" && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--muted)]/30 p-2.5 text-[11px]">
          <div>
            <span className="text-[var(--muted-foreground)]">Route:</span>
            <p className="font-bold text-[var(--foreground)]">
              {String(proposal.details.origin)} → {String(proposal.details.destination)}
            </p>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Departure:</span>
            <p className="font-bold text-[var(--foreground)]">{String(proposal.details.departureDate)}</p>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Target Price:</span>
            <p className="font-bold text-sky-400">{String(proposal.details.formattedTargetPrice)}</p>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Monitoring:</span>
            <p className="font-bold text-emerald-400">4h Autonomous Cron</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setDismissed(true)}
          className="h-8 px-3 text-xs gap-1"
        >
          <X className="h-3 w-3" />
          Dismiss
        </Button>
        <Button
          variant={proposal.action === "delete_tracker" ? "destructive" : "default"}
          size="sm"
          disabled={loading}
          onClick={handleConfirm}
          className="h-8 px-3.5 text-xs font-bold gap-1.5 shadow-sm"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          <span>{proposal.action === "delete_tracker" ? "Confirm Deletion" : "Confirm & Activate"}</span>
        </Button>
      </div>
    </div>
  );
}
