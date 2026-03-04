import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_STATUSES, STATUS_CONFIG, type ApplicationStatus } from "@/lib/constants";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Application = Tables<"applications">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application?: Application | null;
}

export function ApplicationFormDialog({ open, onOpenChange, application }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!application;

  const [form, setForm] = useState({
    company: application?.company ?? "",
    position: application?.position ?? "",
    url: application?.url ?? "",
    salary_min: application?.salary_min?.toString() ?? "",
    salary_max: application?.salary_max?.toString() ?? "",
    location: application?.location ?? "",
    status: (application?.status ?? "wishlist") as ApplicationStatus,
    date_applied: application?.date_applied ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company: form.company.trim(),
        position: form.position.trim(),
        url: form.url.trim() || null,
        salary_min: form.salary_min ? parseInt(form.salary_min) : null,
        salary_max: form.salary_max ? parseInt(form.salary_max) : null,
        location: form.location.trim() || null,
        status: form.status,
        date_applied: form.date_applied || null,
        user_id: user!.id,
      };

      if (isEdit) {
        const { error } = await supabase.from("applications").update(payload).eq("id", application!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("applications").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(isEdit ? "Application updated" : "Application added");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Application" : "Add Application"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company *</Label>
              <Input value={form.company} onChange={(e) => update("company", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Position *</Label>
              <Input value={form.position} onChange={(e) => update("position", e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={form.url} onChange={(e) => update("url", e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Salary Min</Label>
              <Input type="number" value={form.salary_min} onChange={(e) => update("salary_min", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Salary Max</Label>
              <Input type="number" value={form.salary_max} onChange={(e) => update("salary_max", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date Applied</Label>
              <Input type="date" value={form.date_applied} onChange={(e) => update("date_applied", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
