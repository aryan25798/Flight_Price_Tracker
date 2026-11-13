"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminActionDispatch } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function TriggerPollButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handlePoll() {
    setLoading(true);
    try {
      const res = await adminActionDispatch({ action: "trigger_poll" }, ["/admin"]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Manual polling cycle completed");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePoll} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Run Poll Now
    </Button>
  );
}
