import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  name: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

export function CompanyLogo({ name, logoUrl, className, imageClassName }: Props) {
  const isStoredLogo = logoUrl?.startsWith("company-logos/") ?? false;
  const storagePath = isStoredLogo ? logoUrl?.slice("company-logos/".length) : null;
  const { data: signedUrl } = useQuery({
    queryKey: ["company-logo-url", storagePath],
    enabled: !!storagePath,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!storagePath) return null;
      const { data, error } = await supabase.storage.from("company-logos").createSignedUrl(storagePath, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const src = isStoredLogo ? signedUrl : logoUrl;

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background",
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className={cn("h-full w-full object-contain", imageClassName)} />
      ) : (
        <Building2 className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}