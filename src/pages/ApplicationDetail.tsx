import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { ApplicationFormDialog } from "@/components/ApplicationFormDialog";
import { ArrowLeft, Pencil, Plus, Trash2, Upload, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  // Notes state
  const [noteContent, setNoteContent] = useState("");
  // Contact state
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", role: "" });
  // Reminder state
  const [reminderForm, setReminderForm] = useState({ title: "", due_date: "" });

  const { data: app, isLoading } = useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("application_notes").select("*").eq("application_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("application_contacts").select("*").eq("application_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("application_reminders").select("*").eq("application_id", id!).order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", id],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("documents").list(`${user!.id}/${id}`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && !!user,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["notes", id] });
    queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    queryClient.invalidateQueries({ queryKey: ["reminders", id] });
    queryClient.invalidateQueries({ queryKey: ["files", id] });
    queryClient.invalidateQueries({ queryKey: ["application", id] });
  };

  // Add note
  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("application_notes").insert({
        application_id: id!, user_id: user!.id, content: noteContent.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setNoteContent(""); invalidateAll(); toast.success("Note added"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete note
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("application_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Note deleted"); },
  });

  // Add contact
  const addContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("application_contacts").insert({
        application_id: id!, user_id: user!.id,
        name: contactForm.name.trim(),
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        role: contactForm.role.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setContactForm({ name: "", email: "", phone: "", role: "" }); invalidateAll(); toast.success("Contact added"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete contact
  const deleteContact = useMutation({
    mutationFn: async (cId: string) => {
      const { error } = await supabase.from("application_contacts").delete().eq("id", cId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Contact deleted"); },
  });

  // Add reminder
  const addReminder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("application_reminders").insert({
        application_id: id!, user_id: user!.id,
        title: reminderForm.title.trim(),
        due_date: new Date(reminderForm.due_date).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setReminderForm({ title: "", due_date: "" }); invalidateAll(); toast.success("Reminder added"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle reminder complete
  const toggleReminder = useMutation({
    mutationFn: async ({ rId, done }: { rId: string; done: boolean }) => {
      const { error } = await supabase.from("application_reminders").update({ is_completed: done }).eq("id", rId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  // Delete reminder
  const deleteReminder = useMutation({
    mutationFn: async (rId: string) => {
      const { error } = await supabase.from("application_reminders").delete().eq("id", rId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Reminder deleted"); },
  });

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${user!.id}/${id}/${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("File uploaded");
      invalidateAll();
    }
    e.target.value = "";
  };

  // Delete file
  const deleteFile = async (fileName: string) => {
    const path = `${user!.id}/${id}/${fileName}`;
    const { error } = await supabase.storage.from("documents").remove([path]);
    if (error) toast.error(error.message);
    else { toast.success("File deleted"); invalidateAll(); }
  };

  // Get download URL
  const getFileUrl = (fileName: string) => {
    const path = `${user!.id}/${id}/${fileName}`;
    const { data } = supabase.storage.from("documents").getPublicUrl(path);
    return data.publicUrl;
  };

  // Create signed URL for private bucket
  const downloadFile = async (fileName: string) => {
    const path = `${user!.id}/${id}/${fileName}`;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  if (!app) {
    return <div className="py-12 text-center text-muted-foreground">Application not found</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/applications")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{app.company}</h1>
          <p className="text-lg text-muted-foreground">{app.position}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={app.status} />
            {app.location && <span className="text-sm text-muted-foreground">{app.location}</span>}
            {app.date_applied && (
              <span className="text-sm text-muted-foreground">
                Applied {format(parseISO(app.date_applied), "MMM d, yyyy")}
              </span>
            )}
          </div>
          {(app.salary_min || app.salary_max) && (
            <p className="mt-1 text-sm text-muted-foreground">
              Salary: {app.salary_min ? `$${app.salary_min.toLocaleString()}` : "?"} – {app.salary_max ? `$${app.salary_max.toLocaleString()}` : "?"}
            </p>
          )}
          {app.url && (
            <a href={app.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Job listing
            </a>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); if (noteContent.trim()) addNote.mutate(); }} className="flex gap-2">
              <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Add a note..." className="min-h-[60px]" />
              <Button type="submit" size="icon" disabled={!noteContent.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border p-3">
                <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{format(parseISO(n.created_at), "MMM d, yyyy h:mm a")}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteNote.mutate(n.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => { e.preventDefault(); if (contactForm.name.trim()) addContact.mutate(); }}
              className="grid gap-2 sm:grid-cols-2"
            >
              <Input placeholder="Name *" value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} required />
              <Input placeholder="Role" value={contactForm.role} onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))} />
              <Input placeholder="Email" type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
              <Button type="submit" className="sm:col-span-2">
                <Plus className="mr-2 h-4 w-4" /> Add Contact
              </Button>
            </form>
            {contacts.map((c) => (
              <div key={c.id} className="flex items-start justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <p className="font-medium">{c.name} {c.role && <span className="text-muted-foreground">— {c.role}</span>}</p>
                  {c.email && <p className="text-muted-foreground">{c.email}</p>}
                  {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteContact.mutate(c.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => { e.preventDefault(); if (reminderForm.title.trim() && reminderForm.due_date) addReminder.mutate(); }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <Input placeholder="Reminder title" value={reminderForm.title} onChange={(e) => setReminderForm((f) => ({ ...f, title: e.target.value }))} required className="flex-1" />
              <Input type="datetime-local" value={reminderForm.due_date} onChange={(e) => setReminderForm((f) => ({ ...f, due_date: e.target.value }))} required />
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </form>
            {reminders.map((r) => {
              const overdue = !r.is_completed && new Date(r.due_date) < new Date();
              return (
                <div key={r.id} className={`flex items-center justify-between rounded-lg border p-3 ${overdue ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={r.is_completed}
                      onCheckedChange={(checked) => toggleReminder.mutate({ rId: r.id, done: !!checked })}
                    />
                    <div>
                      <p className={`text-sm font-medium ${r.is_completed ? "line-through text-muted-foreground" : ""}`}>{r.title}</p>
                      <p className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {format(parseISO(r.due_date), "MMM d, yyyy h:mm a")}
                        {overdue && " — Overdue"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteReminder.mutate(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label htmlFor="file-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-4 hover:bg-muted/50">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload resume, cover letter, or other documents</span>
              <input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} />
            </Label>
            {files.map((f) => (
              <div key={f.name} className="flex items-center justify-between rounded-lg border p-3">
                <button onClick={() => downloadFile(f.name)} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                  <FileText className="h-4 w-4" />
                  {f.name}
                </button>
                <Button variant="ghost" size="icon" onClick={() => deleteFile(f.name)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ApplicationFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        application={app}
      />
    </div>
  );
}
