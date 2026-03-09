import { useState, useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export default function VerifyEmail() {
  const { user } = useAuth();
  const location = useLocation();
  const email = (location.state as any)?.email || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (user) return <Navigate to="/" replace />;
  if (!email) return <Navigate to="/signup" replace />;

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email verified! Welcome aboard.");
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("A new code has been sent to your email");
      setCooldown(60);
    }
    setResending(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a 6-digit verification code to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <Button onClick={handleVerify} disabled={loading || otp.length !== 6} className="w-full">
            {loading ? "Verifying..." : "Verify email"}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full text-sm"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Sending..." : "Resend code"}
          </Button>
          <Link to="/signup" className="text-sm text-primary hover:underline">
            Use a different email
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
