"use client";

import { useActionState } from "react";
import {
  CheckCircle2,
  Clock3,
  FlaskConical,
  RefreshCcw,
  TimerReset,
  TriangleAlert,
} from "lucide-react";
import { runDemoAction } from "@/app/actions/demo";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";
import type { DemoActionState } from "@/types";

const initialState: DemoActionState = { status: "idle", message: "" };

export function DemoTools() {
  const [state, formAction, pending] = useActionState(runDemoAction, initialState);
  const { language, t } = useApp();

  return (
    <section
      aria-labelledby="demo-tools-title"
      className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-5 dark:border-amber-700 dark:bg-amber-950/20 md:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
          <FlaskConical aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">
            {t("demoMode")}
          </p>
          <h2 id="demo-tools-title" className="mt-1 text-2xl font-extrabold">
            {t("hackathonDemoTools")}
          </h2>
          <p className="mt-2 leading-relaxed text-muted">
            {t("demoToolsHelp")}
          </p>
        </div>
      </div>

      <form
        action={formAction}
        className="mt-6"
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (
            submitter?.value === "reset"
            && !window.confirm(
              t("demoResetConfirm"),
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="confirm_reset" value="RESET_DEMO_DATA" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" name="demo_action" value="due_now" variant="secondary" disabled={pending}>
            <Clock3 />{t("doseDueNow")}
          </Button>
          <Button type="submit" name="demo_action" value="taken" variant="success" disabled={pending}>
            <CheckCircle2 />{t("doseTaken")}
          </Button>
          <Button type="submit" name="demo_action" value="late" variant="warning" disabled={pending}>
            <TimerReset />{t("doseLate")}
          </Button>
          <Button type="submit" name="demo_action" value="missed" variant="danger" disabled={pending}>
            <TriangleAlert />{t("doseMissed")}
          </Button>
          <Button
            type="submit"
            name="demo_action"
            value="reset"
            variant="secondary"
            className="sm:col-span-2"
            disabled={pending}
          >
            <RefreshCcw className={pending ? "animate-spin" : ""} />
            {pending ? t("updatingDemo") : t("resetDemoData")}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4 min-h-6">
        {state.status !== "idle" ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-2xl px-4 py-3 text-sm font-bold ${
              state.status === "success"
                ? "bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-100"
                : "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-100"
            }`}
          >
            {language === "en" && state.message
              ? state.message
              : t(state.status === "success" ? "demoActionSuccess" : "demoActionError")}
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        {t("demoResetHelp")}
      </p>
    </section>
  );
}
