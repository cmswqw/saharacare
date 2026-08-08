import { CircleAlert, Pill } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function DataErrorState({ message }: { message: string }) {
  return (
    <Card className="border-red-200 bg-red-50 p-6 dark:bg-red-950/20">
      <div className="flex items-start gap-4">
        <CircleAlert className="mt-0.5 h-7 w-7 shrink-0 text-danger" />
        <div>
          <h2 className="text-xl font-extrabold">We couldn’t load this information</h2>
          <p className="mt-2 leading-relaxed text-muted">{message}</p>
        </div>
      </div>
    </Card>
  );
}

export function MedicationEmptyState({ children }: { children?: React.ReactNode }) {
  return (
    <Card className="border-dashed p-8 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40">
        <Pill className="h-9 w-9 rotate-45" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold">No medications yet</h2>
      <p className="mx-auto mt-2 max-w-lg leading-relaxed text-muted">
        Add the first medication and its daily times to start a simple care plan.
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
    </Card>
  );
}
