import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Fuel, Mail, Lock, Eye, EyeOff, User, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("attendant");
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();

  // Branded sign-in: fetch company name and logo from system preferences
  const { data: branding } = useQuery({
    queryKey: ["login-branding"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "system_preferences")
        .maybeSingle();
      const v = (data?.value as any) ?? {};
      return {
        companyName: (v.company_name as string | undefined) || "FMS",
        logoUrl: (v.logo_url as string | undefined) || null,
      };
    },
  });
  const companyName = branding?.companyName ?? "FMS";
  const logoUrl = branding?.logoUrl ?? null;

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, selectedRole);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created! Please check your email to verify, then sign in.");
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
          // Navigation handled by useEffect when user state updates
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Helmet>
      <title>Sign in — Forecourt MS</title>
      <meta name="description" content="Sign in to Forecourt MS to manage tanks, pumps, shifts, deliveries, and cash reports across your petrol stations in Liberia." />
      <link rel="canonical" href="https://forecourt-ms.lovable.app/login" />
      <meta property="og:title" content="Sign in — Forecourt MS" />
      <meta property="og:description" content="Sign in to Forecourt MS to manage tanks, pumps, shifts, deliveries, and cash reports across your petrol stations in Liberia." />
      <meta property="og:url" content="https://forecourt-ms.lovable.app/login" />
    </Helmet>
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-sidebar-primary blur-3xl" />
          <div className="absolute bottom-32 right-20 w-96 h-96 rounded-full bg-sidebar-primary blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-primary/10 overflow-hidden">
                <img src={logoUrl} alt={`${companyName} logo`} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-primary">
                <Fuel className="h-6 w-6 text-sidebar-primary-foreground" aria-hidden="true" />
              </div>
            )}
            <div>
              <p className="text-2xl font-bold text-sidebar-foreground">{companyName}</p>
              <p className="text-sm text-sidebar-foreground/60">Forecourt Management</p>
            </div>
          </div>
          <div className="space-y-6">
            <p className="text-4xl font-bold text-sidebar-foreground leading-tight">
              Manage Your Petrol Stations with{" "}
              <span className="text-sidebar-primary">Precision</span>
            </p>
            <p className="text-lg text-sidebar-foreground/70 max-w-md">
              Complete forecourt management solution for multi-branch operations across Liberia.
            </p>
            <div className="grid grid-cols-3 gap-6 pt-6">
              <div><p className="text-3xl font-bold text-sidebar-primary">15</p><p className="text-sm text-sidebar-foreground/60">Counties</p></div>
              <div><p className="text-3xl font-bold text-sidebar-primary">50+</p><p className="text-sm text-sidebar-foreground/60">Stations</p></div>
              <div><p className="text-3xl font-bold text-sidebar-primary">24/7</p><p className="text-sm text-sidebar-foreground/60">Operations</p></div>
            </div>
          </div>
          <p className="text-sm text-sidebar-foreground/40">© 2025 Forecourt Management System</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-4">
            {logoUrl ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 overflow-hidden">
                <img src={logoUrl} alt={`${companyName} logo`} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Fuel className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
              </div>
            )}
            <div>
              <p className="text-2xl font-bold text-foreground">{companyName}</p>
              <p className="text-sm text-muted-foreground">Forecourt Management</p>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {isSignUp ? `Create your ${companyName} account` : `Sign in to ${companyName}`}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignUp ? "Sign up to get started with FMS" : "Sign in to your account to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10" required={isSignUp} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="pl-10"><SelectValue placeholder="Select your role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin — Full system access</SelectItem>
                        <SelectItem value="supervisor">Supervisor — Branch management</SelectItem>
                        <SelectItem value="dealer">Dealer — Full access to own station</SelectItem>
                        <SelectItem value="cashier">Cashier — Cash & sales reports</SelectItem>
                        <SelectItem value="attendant">Attendant — Shift sales entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="email" type="email" placeholder="admin@fms.lr" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && <button type="button" className="text-sm text-primary hover:underline">Forgot password?</button>}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 sm:h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create account" : "Sign in")}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>

          {!isSignUp && (
            <div className="pt-4 sm:pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">Available roles:</p>
              <div className="flex flex-wrap gap-2">
                {["Admin", "Supervisor", "Dealer", "Cashier", "Attendant"].map((role) => (
                  <span key={role} className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-muted text-muted-foreground">{role}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  );
}
