import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SubscriptionState {
  subscribed: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  subscriptionEnd: string | null;
  productId: string | null;
  loading: boolean;
  hasAccess: boolean; // true if subscribed OR trial active
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState>({
  subscribed: false,
  trialActive: false,
  trialEndsAt: null,
  subscriptionEnd: null,
  productId: null,
  loading: true,
  hasAccess: true,
  checkSubscription: async () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscribed(data.subscribed ?? false);
      setTrialActive(data.trial_active ?? false);
      setTrialEndsAt(data.trial_ends_at ?? null);
      setSubscriptionEnd(data.subscription_end ?? null);
      setProductId(data.product_id ?? null);
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setSubscribed(false);
      setTrialActive(false);
      setLoading(false);
    }
  }, [user, checkSubscription]);

  // Refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const hasAccess = subscribed || trialActive;

  return (
    <SubscriptionContext.Provider
      value={{ subscribed, trialActive, trialEndsAt, subscriptionEnd, productId, loading, hasAccess, checkSubscription }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
