export function Switch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-9 w-16 shrink-0 rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <span className={`block h-7 w-7 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-7" : "translate-x-0"}`} />
    </button>
  );
}
