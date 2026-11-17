"use client";

import { useActionState } from "react";
import { manageDirectoryAction } from "@/app/actions/directory-admin";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { approvalStates, verificationStates, publicationStates, type DirectoryAdminProvider, type DirectoryAdminState } from "@/lib/directory/admin-contracts";
import type { TranslationKey } from "@/lib/i18n";

const stateLabels: Record<string, TranslationKey> = {
  pending: "pending", approved: "listingApproved", rejected: "listingRejected", unverified: "listingUnverified", verified: "listingVerified",
  draft: "listingDraft", published: "listingPublished", suspended: "listingSuspended", listing: "listingPlan", sponsored: "listingSponsored",
  paid: "listingPaymentRecorded", revoked: "listingRevoked",
};

function StateSelect({ name, labelKey, value, options }: { name: string; labelKey: TranslationKey; value: string; options: readonly string[] }) {
  const { t } = useApp();
  return <label className="block space-y-1 text-sm font-bold"><span>{t(labelKey)}</span><select name={name} defaultValue={value} className="field-control">{options.map(option => <option key={option} value={option}>{t(stateLabels[option])}</option>)}</select></label>;
}

function AdminForm({ operation, id, children }: { operation: string; id: string; children?: React.ReactNode }) {
  const { t } = useApp();
  const [state, action, pending] = useActionState(manageDirectoryAction, { status: "idle" } as const);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="operation" value={operation} /><input type="hidden" name="id" value={id} />
    {children}
    <label className="block space-y-1 text-sm font-bold"><span>{t("listingAuditReason")}</span><input required name="reason" maxLength={1000} className="field-control" /></label>
    <Button type="submit" disabled={pending}>{t(pending ? "saving" : operation === "record_payment" ? "listingRecordPayment" : operation === "revoke_entitlement" ? "listingRevokePayment" : "saveChanges")}</Button>
    {state.status !== "idle" ? <p role={state.status === "error" ? "alert" : "status"} className="text-sm font-bold">{t(state.status === "success" ? "listingUpdateSaved" : "listingUpdateFailed")}</p> : null}
  </form>;
}

function ProviderControls({ provider }: { provider: DirectoryAdminProvider }) {
  const { t } = useApp();
  return <Card className="min-w-0 space-y-4 p-4">
    <h3 className="break-words font-extrabold">{provider.display_name}{provider.is_demo ? <span className="ms-2 text-sm text-warning">{t("listingDemo")}</span> : null}</h3>
    <AdminForm operation="provider" id={provider.id}>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={provider.active} />{t("active")}</label>
      <div className="grid gap-3 sm:grid-cols-3"><StateSelect name="approval_status" labelKey="listingApproval" value={provider.approval_status} options={approvalStates} /><StateSelect name="verification_status" labelKey="listingVerification" value={provider.verification_status} options={verificationStates} /><StateSelect name="publication_status" labelKey="listingPublication" value={provider.publication_status} options={publicationStates} /></div>
      <label className="block space-y-1 text-sm font-bold"><span>{t("listingEvidence")}</span><input name="verification_reference" defaultValue={provider.verification_reference ?? ""} maxLength={200} className="field-control" /></label>
      <p className="text-sm leading-relaxed text-muted">{t("listingVerificationHelp")}</p>
    </AdminForm>
  </Card>;
}

export function DirectoryAdministration({ state }: { state: DirectoryAdminState | null }) {
  const { t, language } = useApp();
  return <section className="mt-8 space-y-5" aria-labelledby="listing-admin-title">
    <h2 id="listing-admin-title" className="section-title">{t("listingAdministration")}</h2>
    <p className="rounded-xl border bg-card p-4 text-sm leading-relaxed">{t("listingManualNotice")}</p>
    {!state ? <p role="alert">{t("listingLoadFailed")}</p> : <>
      {state.providers.length === 0 ? <p>{t("listingEmpty")}</p> : <div className="space-y-4">{state.providers.map(provider => <ProviderControls key={provider.id} provider={provider} />)}</div>}
      {state.affiliations.map(affiliation => <Card key={affiliation.id} className="space-y-3 p-4"><h3 className="font-bold">{affiliation.doctor_name} · {affiliation.facility_name}</h3><AdminForm operation="affiliation" id={affiliation.id}><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={affiliation.active} />{t("active")}</label><StateSelect name="approval_status" labelKey="listingApproval" value={affiliation.approval_status} options={approvalStates} /></AdminForm></Card>)}
      {state.providers.length > 0 ? <Card className="space-y-4 p-4"><h3 className="font-extrabold">{t("listingRecordPayment")}</h3><PaymentForm providers={state.providers} /></Card> : null}
      {state.entitlements.map(entitlement => <Card key={entitlement.id} className="space-y-3 p-4"><h3 className="break-words font-bold">{state.providers.find(provider=>provider.id===entitlement.provider_id)?.display_name ?? entitlement.provider_id}</h3><p className="break-words text-sm">{t(stateLabels[entitlement.plan])} · {t(stateLabels[entitlement.payment_status])} · {t(entitlement.in_period ? "listingInPeriod" : "listingOutsidePeriod")}{entitlement.is_demo ? ` · ${t("listingDemo")}` : ""}</p><p className="break-words text-sm">{entitlement.payment_reference}</p><p className="text-sm">{new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(new Date(entitlement.starts_at))} — {new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(new Date(entitlement.ends_at))}</p>{entitlement.payment_status !== "revoked" ? <AdminForm operation="revoke_entitlement" id={entitlement.id} /> : null}</Card>)}
      <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer py-2 font-bold">{t("listingAuditTrail")}</summary><ul className="mt-3 space-y-3">{state.audit.map(event=><li key={event.id} className="break-words border-t pt-3 text-sm"><time dateTime={event.changed_at}>{event.changed_at}</time><p>{event.entity_table} · {event.operation} · {event.entity_id}</p><p>{t("listingChangedBy")}: {event.actor_id ?? t("listingTrustedServer")}</p><p>{event.reason}</p></li>)}</ul></details>
    </>}
  </section>;
}

function PaymentForm({ providers }: { providers: DirectoryAdminProvider[] }) {
  const { t } = useApp();
  const [state, action, pending] = useActionState(manageDirectoryAction, { status: "idle" } as const);
  return <form action={action} className="space-y-3"><input type="hidden" name="operation" value="record_payment" />
    <label className="block text-sm font-bold">{t("listingProvider")}<select required name="id" className="field-control">{providers.map(provider=><option key={provider.id} value={provider.id}>{provider.display_name}</option>)}</select></label>
    <StateSelect name="plan" labelKey="listingPlan" value="listing" options={["listing","sponsored"]} />
    <label className="block text-sm font-bold">{t("listingPaymentReference")}<input required name="payment_reference" maxLength={200} className="field-control" /></label>
    <p className="text-sm text-muted">{t("listingNepalTime")}</p>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">{t("listingStarts")}<input required type="datetime-local" name="starts_at" className="field-control" /></label><label className="block text-sm font-bold">{t("listingEnds")}<input required type="datetime-local" name="ends_at" className="field-control" /></label></div>
    <label className="block text-sm font-bold">{t("listingAuditReason")}<input required name="reason" maxLength={1000} className="field-control" /></label>
    <Button disabled={pending} type="submit">{t(pending ? "saving" : "listingRecordPayment")}</Button>
    {state.status !== "idle" ? <p role={state.status === "error" ? "alert" : "status"}>{t(state.status === "success" ? "listingUpdateSaved" : "listingUpdateFailed")}</p> : null}
  </form>;
}
