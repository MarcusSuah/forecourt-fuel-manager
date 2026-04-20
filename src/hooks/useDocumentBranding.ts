import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sets <title> and <meta name="description"> based on the company name stored in
 * system_preferences. Mounted once at the app root so every page benefits.
 */
export function useDocumentBranding() {
  const { data } = useQuery({
    queryKey: ["document-branding"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "system_preferences")
        .maybeSingle();
      const v = (data?.value as any) ?? {};
      return {
        companyName: (v.company_name as string | undefined) || "Forecourt Management System",
        tagline: (v.tagline as string | undefined) || "Multi-branch forecourt management for petrol stations",
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    const { companyName, tagline } = data;
    document.title = `${companyName} — Forecourt Management`;
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setProp = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const description = `${companyName} — ${tagline}`;
    setMeta("description", description);
    setProp("og:title", companyName);
    setProp("og:description", description);
  }, [data]);
}