"use client";

import { useActionState } from "react";
import { Check, Pill } from "lucide-react";
import { markDoseAsTakenAction } from "@/app/actions/phase5";
import { Button } from "@/components/ui/Button";
import { formatDoseTimestamp } from "@/lib/dose-config";
import type { DoseStatus, Phase5ActionState } from "@/types";

const initialState: Phase5ActionState = { status: "idle", message: "" };

export function MarkDoseTakenButton({
  doseId,
  status,
  takenAt,
  large = false,
}: {
  doseId: string;
  status: DoseStatus;
  takenAt: string | null;
  large?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    markDoseAsTakenAction,
    initialState,
  );
  const effectiveTakenAt = state.takenAt ?? takenAt;
  const isTaken = status === "taken" || state.status === "success";

  if (isTaken && effectiveTakenAt) {
    return (
      <p className="flex min-h-12 items-center gap-2 rounded-2xl bg-green-50 px-4 font-extrabold text-green-800 dark:bg-green-950/30 dark:text-green-200">
        <Check />Taken at {formatDoseTimestamp(effectiveTakenAt)}
      </p>
    );
  }

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="dose_id" value={doseId} />
        <Button
          type="submit"
          size={large ? "large" : "default"}
          className={large ? "w-full" : ""}
          disabled={pending}
        >
          <Pill className="rotate-45" />
          {pending ? "Saving…" : "Mark as Taken"}
        </Button>
      </form>
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm font-bold text-danger">{state.message}</p>
      ) : null}
    </div>
  );
}
