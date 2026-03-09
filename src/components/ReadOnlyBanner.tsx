import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export function ReadOnlyBanner() {
  const { hasAccess, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading || hasAccess) return null;

  return (
    <Card className="mb-6 border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.05)]">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-[hsl(var(--warning))]" />
          <div>
            <p className="font-medium text-foreground">Your free trial has ended</p>
            <p className="text-sm text-muted-foreground">
              You're in read-only mode. Subscribe to add and edit applications.
            </p>
          </div>
        </div>
        <Button onClick={() => navigate("/pricing")}>View Plans</Button>
      </CardContent>
    </Card>
  );
}
