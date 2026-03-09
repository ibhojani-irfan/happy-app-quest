import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";

const features = [
  "Unlimited job applications",
  "Kanban board & table views",
  "Notes, contacts & reminders",
  "CSV import & URL scraping",
  "Document uploads",
  "Dashboard analytics",
];

export default function Pricing() {
  const { subscribed, trialActive, trialEndsAt } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    setLoadingPlan(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          {trialActive && !subscribed
            ? "Your free trial is active. Subscribe anytime to keep full access."
            : subscribed
            ? "You're already subscribed. Thank you!"
            : "Your trial has ended. Subscribe to regain full access."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Plan */}
        <Card className="relative flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">{PLANS.monthly.name}</CardTitle>
            <CardDescription>Pay as you go, cancel anytime</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">${PLANS.monthly.price}</span>
              <span className="text-muted-foreground"> AUD/month</span>
            </div>
            <ul className="space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-[hsl(var(--success))]" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant="outline"
              disabled={subscribed || loadingPlan !== null}
              onClick={() => handleCheckout(PLANS.monthly.price_id)}
            >
              {loadingPlan === PLANS.monthly.price_id
                ? "Redirecting..."
                : subscribed
                ? "Current Plan"
                : "Get Monthly"}
            </Button>
          </CardFooter>
        </Card>

        {/* Yearly Plan */}
        <Card className="relative flex flex-col border-primary">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground gap-1">
              <Sparkles className="h-3 w-3" />
              Best Value
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-xl">{PLANS.yearly.name}</CardTitle>
            <CardDescription>Save 17% with annual billing</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">${PLANS.yearly.price}</span>
              <span className="text-muted-foreground"> AUD/year</span>
            </div>
            <ul className="space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-[hsl(var(--success))]" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={subscribed || loadingPlan !== null}
              onClick={() => handleCheckout(PLANS.yearly.price_id)}
            >
              {loadingPlan === PLANS.yearly.price_id
                ? "Redirecting..."
                : subscribed
                ? "Current Plan"
                : "Get Yearly"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
