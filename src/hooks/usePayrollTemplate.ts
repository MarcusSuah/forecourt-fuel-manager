import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mergeTemplate } from "@/lib/payroll";

export function usePayrollTemplate() {
  return useQuery({
    queryKey: ["payroll-template"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "payroll_template").maybeSingle();
      return mergeTemplate(data?.value);
    },
  });
}
