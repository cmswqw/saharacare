"use client";

import { useState } from "react";
import { Check, Copy, Link2, ShieldCheck, UserRound, X } from "lucide-react";
import {
  approveCaregiverLinkAction,
  removeCaregiverLinkAction,
} from "@/app/actions/phase4";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LinkedCaregiver } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

export function PatientLinkingCard({
  linkingCode,
  links,
}: {
  linkingCode: string;
  links: LinkedCaregiver[];
}) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const pendingLinks = links.filter((link) => link.status === "pending");
  const acceptedLinks = links.filter((link) => link.status === "accepted");

  async function copyCode() {
    await navigator.clipboard.writeText(linkingCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card id="caregiver-access" className="scroll-mt-24 overflow-hidden">
      <div className="border-b bg-blue-50 p-5 dark:bg-blue-950/30 md:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-primary dark:bg-slate-900">
            <Link2 />
          </span>
          <div>
            <p className="eyebrow">{t("caregiverAccess")}</p>
            <h2 className="mt-1 text-2xl font-extrabold">{t("linkTrustedCaregiver")}</h2>
            <p className="mt-2 leading-relaxed text-muted">
              {t("caregiverCodeHelp")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
          <code className="flex-1 text-center text-2xl font-extrabold tracking-[0.15em] sm:text-left">
            {linkingCode}
          </code>
          <Button type="button" variant="secondary" onClick={copyCode}>
            {copied ? <Check /> : <Copy />}
            {t(copied ? "copied" : "copyCode")}
          </Button>
        </div>
      </div>

      <div className="p-5 md:p-6">
        {pendingLinks.length > 0 ? (
          <div>
            <h3 className="text-lg font-extrabold">{t("requestsWaiting")}</h3>
            <div className="mt-3 space-y-3">
              {pendingLinks.map((link) => (
                <div key={link.link_id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-800">
                    <UserRound />
                  </span>
                  <div className="flex-1">
                    <p className="font-extrabold">{link.caregiver?.full_name ?? t("caregiverRequest")}</p>
                    <p className="mt-1 text-sm text-muted">{t("pendingNoAccess")}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveCaregiverLinkAction}>
                      <input type="hidden" name="link_id" value={link.link_id} />
                      <Button type="submit" variant="success"><Check />{t("approve")}</Button>
                    </form>
                    <form action={removeCaregiverLinkAction}>
                      <input type="hidden" name="link_id" value={link.link_id} />
                      <Button type="submit" variant="secondary"><X />{t("decline")}</Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={pendingLinks.length > 0 ? "mt-6 border-t pt-6" : ""}>
          <h3 className="flex items-center gap-2 text-lg font-extrabold">
            <ShieldCheck className="text-success" />{t("approvedCaregivers")}
          </h3>
          {acceptedLinks.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-muted dark:bg-slate-900">
              {t("noApprovedCaregivers")}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {acceptedLinks.map((link) => (
                <div key={link.link_id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-success">
                    <UserRound />
                  </span>
                  <div className="flex-1">
                    <p className="font-extrabold">{link.caregiver?.full_name ?? t("approvedCaregiver")}</p>
                    <p className="mt-1 text-sm font-bold text-success">{t("caregiverCanView")}</p>
                  </div>
                  <form
                    action={removeCaregiverLinkAction}
                    onSubmit={(event) => {
                      if (!window.confirm(t("removeCaregiverConfirm"))) event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="link_id" value={link.link_id} />
                    <Button type="submit" variant="secondary">{t("removeAccess")}</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
