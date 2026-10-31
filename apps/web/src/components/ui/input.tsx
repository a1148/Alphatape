import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("h-9 w-full rounded-md border border-line bg-panel-2 px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent", className)} {...props} />;
}
