import { supabase } from "@/integrations/supabase/client";
import type { PDFHeaderInfo } from "./pdf-export";

interface BranchLite {
  id: string;
  name: string;
  county?: string | null;
  location?: string | null;
}

let cachedPrefs: { company_name?: string; logo_url?: string } | null = null;
let cachedAt = 0;

async function loadCompanyPrefs() {
  if (cachedPrefs && Date.now() - cachedAt < 60_000) return cachedPrefs;
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "system_preferences")
    .maybeSingle();
  cachedPrefs = (data?.value as any) ?? {};
  cachedAt = Date.now();
  return cachedPrefs;
}

export async function buildPDFHeaderInfo(branch?: BranchLite | null): Promise<PDFHeaderInfo> {
  const prefs = await loadCompanyPrefs();
  const branchAddress = branch
    ? [branch.location, branch.county].filter(Boolean).join(", ")
    : undefined;
  return {
    companyName: prefs?.company_name || "Forecourt Management System",
    branchName: branch?.name,
    branchAddress,
    logoUrl: prefs?.logo_url,
  };
}

export function invalidatePDFHeaderCache() {
  cachedPrefs = null;
}
