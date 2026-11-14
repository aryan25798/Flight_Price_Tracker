"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

interface DeleteAccountCardProps {
  userEmail: string;
}

export function DeleteAccountCard({ userEmail }: DeleteAccountCardProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmationInput, setConfirmationInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const isConfirmed = confirmationInput.trim() === "DELETE";

  async function handleDeleteAccount() {
    if (!isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      toast.success("Account permanently deleted. Goodbye!");
      setOpen(false);
      router.push("/login?message=Account+deleted+successfully");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error during account deletion";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="glass-surface-1 border-rose-500/20 shadow-xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex items-center gap-2.5 text-rose-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <CardTitle className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--foreground)]">
              Danger Zone &amp; Data Erasure
            </CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            In accordance with GDPR Article 17 (&ldquo;Right to be Forgotten&rdquo;) and CCPA regulations, you can permanently delete your AeroDrop account and all associated flight intelligence records.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-2 space-y-4">
          <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4 text-xs text-[var(--muted-foreground)] space-y-2 leading-relaxed">
            <p className="font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              This action is permanent and irreversible
            </p>
            <p>
              Deleting your account permanently erases your tracked flight monitors, alert preferences, Telegram bot linkage, Web Push subscriptions, AI Copilot interaction histories, and authentication credentials.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-[var(--muted-foreground)]">
              Authenticated Account: <strong className="text-[var(--foreground)] font-mono">{userEmail}</strong>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmationInput("");
                setOpen(true);
              }}
              className="gap-2 font-bold text-xs h-9 px-4 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Account</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete AeroDrop Account?"
        description={`Are you sure you want to permanently delete your account (${userEmail})? All flight radar tracking and personal records will be instantly wiped from our database.`}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              To confirm, type <span className="font-mono text-rose-400 font-bold">DELETE</span> below:
            </label>
            <Input
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="DELETE"
              className="font-mono text-sm tracking-wider uppercase h-10"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!isConfirmed || loading}
              onClick={handleDeleteAccount}
              className="gap-2 text-xs font-bold h-9"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>Permanently Delete</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
