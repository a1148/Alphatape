import { Suspense } from "react";
import { Scanner } from "@/components/scanner";

export default function Page() {
  return (
    <Suspense fallback={<div className="panel p-8 text-sm text-muted">…</div>}>
      <Scanner />
    </Suspense>
  );
}
