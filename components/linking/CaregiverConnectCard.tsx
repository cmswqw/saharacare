"use client";

import { useActionState } from "react";
import { Clock3, Link2, ShieldCheck, X } from "lucide-react";
import {
  removeCaregiverLinkAction,
  requestCaregiverLinkAction,
} from "@/app/actions/phase4";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LinkedPatient, Phase4ActionState } from "@/types";

const initialState: Phase4ActionState = {
  status: "idle",
  message: "",
};

export function CaregiverConnectCard({ links }: { links: LinkedPatient[] }) {
  const [state, formAction, pending] = useActionState(
    requestCaregiverLinkAction,
    initialState,
  );
  const pendingLinks = links.filter((link) => link.status === "pending");

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40">
          <Link2 />
        </span>
        <div>
          <p className="eyebrow">Connect securely</p>
          <h2 className="mt-1 text-2xl font-extrabold">Enter a patient linking code</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Ask the patient for their SaharaCare code. Their approval is required before any medication details become visible.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Patient linking code</span>
          <input
            name="patient_code"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="SC-XXXXXXXXXX"
            className="min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-lg font-extrabold uppercase tracking-wider"
          />
        </label>
        <Button type="submit" size="large" disabled={pending}>
          <Link2 />{pending ? "Sending…" : "Send request"}
        </Button>
      </form>

      {state.status !== "idle" ? (
        <p
          role="status"
          className={`mt-4 rounded-2xl p-4 font-bold ${
            state.status === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200"
              : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          {state.status === "success" ? <ShieldCheck className="me-2 inline" /> : null}
          {state.message}
        </p>
      ) : null}

      {pendingLinks.length > 0 ? (
        <div className="mt-5 border-t pt-5">
          <h3 className="font-extrabold">Pending requests</h3>
          <div className="mt-3 space-y-3">
            {pendingLinks.map((link) => (
              <div key={link.link_id} className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <Clock3 className="shrink-0" />
                <p className="flex-1 font-bold">Waiting for patient approval</p>
                <form action={removeCaregiverLinkAction}>
                  <input type="hidden" name="link_id" value={link.link_id} />
                  <Button type="submit" variant="ghost" size="icon" aria-label="Cancel request">
                    <X />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
