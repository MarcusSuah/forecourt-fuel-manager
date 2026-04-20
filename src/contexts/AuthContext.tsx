import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthUser extends User {
  role?: AppRole;
  profile?: {
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserDetails = useCallback(async (userId: string) => {
    try {
      const [{ data: roleData }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("full_name, email, phone, avatar_url").eq("user_id", userId).maybeSingle(),
      ]);
      return {
        role: roleData?.role || undefined,
        profile: profileData || undefined,
      };
    } catch (error) {
      console.error("Error fetching user details:", error);
      return { role: undefined, profile: undefined };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Check existing session first
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      setSession(existingSession);

      if (existingSession?.user) {
        const details = await fetchUserDetails(existingSession.user.id);
        if (!mounted) return;
        setUser({ ...existingSession.user, ...details });
      }
      setIsLoading(false);
    });

    // Then listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock on SIGNED_IN
          setTimeout(async () => {
            if (!mounted) return;
            const details = await fetchUserDetails(newSession.user.id);
            if (!mounted) return;
            setUser({ ...newSession.user, ...details });
            setIsLoading(false);
            // Record login activity (only on actual sign-in, not token refresh)
            if (event === "SIGNED_IN") {
              try {
                await supabase.from("login_activities").insert({
                  user_id: newSession.user.id,
                  user_email: newSession.user.email ?? null,
                  user_full_name: details.profile?.full_name ?? null,
                  role: details.role ?? null,
                  user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
                });
              } catch (err) {
                console.warn("[auth] login activity insert failed:", err);
              }
            }
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserDetails]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, role?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (!error && data.user && role) {
      await supabase.rpc("assign_role_on_signup", {
        _user_id: data.user.id,
        _role: role as any,
      });
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
