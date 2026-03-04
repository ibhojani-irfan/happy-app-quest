import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, type ApplicationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="secondary" className={cn("text-xs font-medium", config.color)}>
      {config.label}
    </Badge>
  );
}
