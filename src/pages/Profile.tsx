import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Save, ShieldAlert, UserCog, KeyRound } from "lucide-react";

export default function Profile() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const mustChange = !!user?.profile?.must_change_credentials;
  const forced = (location.state as { forced?: boolean } | null)?.forced || mustChange;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user?.profile) {
      setFullName(user.profile.full_name || "");
      setPhone(user.profile.phone || "");
      setEmail(user.profile.email || user.email || "");
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const isSeededEmail = (e: string) => /@forecourtms\.local$/i.test(e);
  const emailChanged = email.trim().toLowerCase() !== (user?.email || "").toLowerCase();
  const passwordProvided = password.length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!fullName.trim()) throw new Error("Full name is required");
      if (!email.trim()) throw new Error("Email is required");

      if (forced) {
        if (isSeededEmail(email)) throw new Error("Please replace the default email with your real address");
        if (!passwordProvided) throw new Error("You must set a new password");
      }
      if (passwordProvided) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        if (password !== confirmPassword) throw new Error("Passwords do not match");
      }

      // 1) Auth updates (email + password) via Supabase
      const authPayload: { email?: string; password?: string } = {};
      if (emailChanged) authPayload.email = email.trim();
      if (passwordProvided) authPayload.password = password;
      if (Object.keys(authPayload).length) {
        const { error } = await supabase.auth.updateUser(authPayload);
        if (error) throw error;
      }

      // 2) Profile updates
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim(),
          must_change_credentials: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      setPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries();
      if (forced) {
        setTimeout(() => navigate("/dashboard", { replace: true }), 400);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!user || !session) return null;

  return (
    <AppLayout title="My Profile" subtitle="Manage your personal account credentials">
      <div className="max-w-2xl mx-auto space-y-6">
        {forced && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Action required</AlertTitle>
            <AlertDescription>
              This account was created with default credentials. You must replace your email
              and set a new password before continuing to the rest of the system.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-5 w-5 text-primary" /> Personal Details
            </CardTitle>
            <CardDescription>Your name, contact number, and login email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+231 ..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email {forced && <span className="text-destructive">*</span>}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              {forced && isSeededEmail(email) && (
                <p className="text-xs text-destructive">Replace the default email with your real address.</p>
              )}
              {emailChanged && !forced && (
                <p className="text-xs text-muted-foreground">A confirmation email may be sent to verify this change.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-primary" /> {forced ? "Set a new password" : "Change password"}
            </CardTitle>
            <CardDescription>
              {forced ? "Required — choose a password only you know." : "Leave blank to keep your current password."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
            <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}