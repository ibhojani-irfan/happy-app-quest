import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_STATUSES, STATUS_CONFIG, type ApplicationStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ExternalLink, GripVertical, Briefcase } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Application = Tables<"applications">;

interface KanbanBoardProps {
  applications: Application[];
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  search: string;
}

export function KanbanBoard({ applications, onEdit, onDelete, search }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ApplicationStatus | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicationStatus }) => {
      const { error } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = applications.filter(
    (a) =>
      a.company.toLowerCase().includes(search.toLowerCase()) ||
      a.position.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = ALL_STATUSES.reduce((acc, status) => {
    acc[status] = filtered.filter((a) => a.status === status);
    return acc;
  }, {} as Record<ApplicationStatus, Application[]>);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Make drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedId(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, status: ApplicationStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setDropTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, status: ApplicationStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const app = applications.find((a) => a.id === id);
    if (app && app.status !== status) {
      updateStatusMutation.mutate({ id, status });
      toast.success(`Moved to ${STATUS_CONFIG[status].label}`);
    }
    setDraggedId(null);
    setDropTarget(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {ALL_STATUSES.map((status) => {
        const items = grouped[status];
        const config = STATUS_CONFIG[status];
        const isOver = dropTarget === status;

        return (
          <div
            key={status}
            className={cn(
              "flex min-w-[260px] max-w-[300px] flex-1 flex-col rounded-xl border bg-card transition-all duration-200",
              isOver && "ring-2 ring-primary/50 border-primary/30 bg-primary/5"
            )}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs font-medium text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                  {items.length}
                </span>
              </div>
            </div>

            {/* Column Body */}
            <div className="flex-1 space-y-2 p-2 min-h-[120px]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                  <Briefcase className="h-6 w-6 mb-1" />
                  <span className="text-xs">Drop here</span>
                </div>
              ) : (
                items.map((app) => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, app.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "group cursor-grab rounded-lg border bg-background p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
                      draggedId === app.id && "opacity-50 scale-95"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/applications/${app.id}`}
                          className="font-medium text-sm text-foreground hover:text-primary hover:underline line-clamp-1"
                        >
                          {app.company}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {app.position}
                        </p>
                        {app.location && (
                          <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-0.5">
                            📍 {app.location}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {app.url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={app.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(app)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(app.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
