import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Linkedin, Globe, FileSpreadsheet, PenLine } from "lucide-react";

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    className: "bg-[hsl(210,80%,95%)] text-[hsl(210,80%,35%)] border-[hsl(210,80%,85%)]",
  },
  seek: {
    label: "Seek",
    icon: Globe,
    className: "bg-[hsl(160,60%,93%)] text-[hsl(160,60%,30%)] border-[hsl(160,60%,80%)]",
  },
  csv_import: {
    label: "CSV",
    icon: FileSpreadsheet,
    className: "bg-[hsl(270,50%,95%)] text-[hsl(270,50%,35%)] border-[hsl(270,50%,85%)]",
  },
  manual: {
    label: "Manual",
    icon: PenLine,
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source] || {
    label: source,
    icon: Globe,
    className: "bg-muted text-muted-foreground border-border",
  };
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] font-medium px-1.5 py-0", config.className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
