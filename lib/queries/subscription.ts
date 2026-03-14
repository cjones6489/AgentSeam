"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { SubscriptionResponse } from "@/lib/validations/subscription";

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () =>
      apiGet<SubscriptionResponse | null>("/api/stripe/subscription"),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (priceId: string) =>
      apiPost<{ url: string }>("/api/stripe/checkout", { priceId }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

export function usePortalSession() {
  return useMutation({
    mutationFn: () => apiPost<{ url: string }>("/api/stripe/portal"),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

export function useSyncCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiPost<SubscriptionResponse>(
        "/api/stripe/subscription/sync",
        { sessionId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}
