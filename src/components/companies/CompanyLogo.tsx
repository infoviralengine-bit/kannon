import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

export function CompanyLogo({ name, logoUrl, className, imageClassName }: Props) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background",
        className,
      )}
      aria-hidden="true"
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className={cn("h-full w-full object-contain", imageClassName)} />
      ) : (
        <Building2 className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}