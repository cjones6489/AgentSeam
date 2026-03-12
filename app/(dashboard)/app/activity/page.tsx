"use client";

import { useApiKeys } from "@/lib/queries/api-keys";
import { RecentActivity } from "@/components/usage/recent-activity";

export default function ActivityPage() {
  const { data: keysData } = useApiKeys();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Activity
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every API call that flows through the proxy.
        </p>
      </div>
      <RecentActivity
        keys={(keysData?.data ?? []).map((k) => ({ id: k.id, name: k.name }))}
      />
    </div>
  );
}
