import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ApplicationFormDialog } from "@/components/ApplicationFormDialog";
import { ALL_STATUSES, STATUS_CONFIG, type ApplicationStatus } from "@/lib/constants";
import { ImportJobsDialog } from "@/components/ImportJobsDialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Plus, Pencil, Trash2, ExternalLink, Download, LayoutGrid, List } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Application = Tables<"applications">;

export default function Applications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<"table" | "kanban">("kanban");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Application deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = applications.filter((a) => {
    const matchSearch = a.company.toLowerCase().includes(search.toLowerCase()) ||
      a.position.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Applications</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={() => { setEditApp(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Application
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Search company or position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          {view === "table" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg border bg-muted p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 rounded-md px-3",
              view === "kanban" && "bg-background shadow-sm text-foreground"
            )}
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4" /> Board
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 rounded-md px-3",
              view === "table" && "bg-background shadow-sm text-foreground"
            )}
            onClick={() => setView("table")}
          >
            <List className="h-4 w-4" /> Table
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : view === "kanban" ? (
        <KanbanBoard
          applications={statusFilter === "all" ? applications : filtered}
          search={search}
          onEdit={(app) => { setEditApp(app); setDialogOpen(true); }}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {applications.length === 0 ? "No applications yet. Add your first one!" : "No matching applications."}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden md:table-cell">Date Applied</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <Link to={`/applications/${app.id}`} className="font-medium text-primary hover:underline">
                      {app.company}
                    </Link>
                  </TableCell>
                  <TableCell>{app.position}</TableCell>
                  <TableCell><StatusBadge status={app.status} /></TableCell>
                  <TableCell className="hidden md:table-cell"><SourceBadge source={app.source} /></TableCell>
                  <TableCell className="hidden md:table-cell">{app.location || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {app.date_applied ? format(parseISO(app.date_applied), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {app.url && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={app.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditApp(app); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(app.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ApplicationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditApp(null); }}
        application={editApp}
      />

      <ImportJobsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
