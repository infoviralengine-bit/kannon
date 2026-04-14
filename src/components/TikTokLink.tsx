import { cleanUsername } from "@/lib/utils";

interface TikTokLinkProps {
  username: string | null | undefined;
  className?: string;
}

export function TikTokLink({ username, className }: TikTokLinkProps) {
  const clean = cleanUsername(username);
  if (!clean) return <span className={className}>—</span>;
  return (
    <a
      href={`https://www.tiktok.com/@${clean}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-primary hover:text-primary/80 hover:underline font-medium transition-colors ${className ?? ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      @{clean}
    </a>
  );
}
