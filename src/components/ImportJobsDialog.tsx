import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link2, FileUp, Loader2, AlertCircle } from "lucide-react";
import { parseJobCsv, parseJobJson } from "@/lib/parseJobCsv";
import type { ApplicationStatus } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportJobsDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // URL tab state
  const [jobUrl, setJobUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [partialData, setPartialData] = useState<{
    message: string;
    data: Record<string, any>;
  } | null>(null);

  // Partial fill form
  const [partialForm, setPartialForm] = useState({ company: "", position: "", location: "" });

  // File tab state
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);

  const scrapeAndAdd = async () => {
    if (!jobUrl.trim()) return;
    setScraping(true);
    setPartialData(null);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-job-url", {
        body: { url: jobUrl.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to scrape");

      // If it's a partial result (blocked site), show manual form
      if (data.partial) {
        setPartialData({ message: data.message, data: data.data });
        setPartialForm({
          company: data.data.company || "",
          position: data.data.position || "",
          location: data.data.location || "",
        });
        return;
      }

      // Full scrape succeeded — validate before inserting
      const job = data.data;
      if (!job.company?.trim() || !job.position?.trim()) {
        // Shouldn't happen now but safety net — show manual form
        setPartialData({
          message: "We couldn't extract all job details. Please fill in the missing information.",
          data: job,
        });
        setPartialForm({
          company: job.company || "",
          position: job.position || "",
          location: job.location || "",
        });
        return;
      }
      await insertApplication(job);
      toast.success(`Added: ${job.position} at ${job.company}`);
      resetAndClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to import from URL");
    } finally {
      setScraping(false);
    }
  };

  const submitPartialForm = async () => {
    if (!partialForm.company.trim() || !partialForm.position.trim()) {
      toast.error("Company and Position are required");
      return;
    }
    try {
      await insertApplication({
        ...partialData!.data,
        company: partialForm.company.trim(),
        position: partialForm.position.trim(),
        location: partialForm.location.trim() || null,
      });
      toast.success(`Added: ${partialForm.position} at ${partialForm.company}`);
      resetAndClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const insertApplication = async (job: Record<string, any>) => {
    const company = (job.company || "").trim();
    const position = (job.position || "").trim();
    if (!company || !position) {
      throw new Error("Company and Position are required. Please fill in the details.");
    }
    const { error } = await supabase.from("applications").insert({
      company,
      position,
      url: job.url || null,
      location: job.location || null,
      salary_min: job.salary_min || null,
      salary_max: job.salary_max || null,
      status: "applied" as ApplicationStatus,
      source: job.source || "manual",
      user_id: user!.id,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const resetAndClose = () => {
    setJobUrl("");
    setPartialData(null);
    setPartialForm({ company: "", position: "", location: "" });
    onOpenChange(false);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const isJson = file.name.endsWith(".json");
    const parsed = isJson ? parseJobJson(text) : parseJobCsv(text);

    if (parsed.valid.length === 0) {
      toast.error(parsed.errors.length > 0 ? parsed.errors[0].message : "No valid rows found");
      return;
    }

    const rows = parsed.valid.map((r) => ({
      company: r.company,
      position: r.position,
      url: r.url || null,
      location: r.location || null,
      salary_min: r.salary_min,
      salary_max: r.salary_max,
      status: (r.status || "applied") as ApplicationStatus,
      date_applied: r.date_applied || null,
      source: r.source || "csv_import",
      user_id: user!.id,
    }));

    const { error } = await supabase.from("applications").insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setImportResult({
        count: rows.length,
        errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`),
      });
      toast.success(`Imported ${rows.length} applications`);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby="import-dialog-desc">
        <DialogHeader>
          <DialogTitle>Import Jobs</DialogTitle>
          <DialogDescription id="import-dialog-desc">
            Import job applications from a URL or upload a CSV/JSON file.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1 gap-2">
              <Link2 className="h-4 w-4" /> From URL
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-2">
              <FileUp className="h-4 w-4" /> CSV / JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Paste a job listing URL. For LinkedIn & Seek, you'll fill in details manually since those sites block automated scraping. Other job sites (Indeed, Glassdoor, company pages) will auto-fill.
            </p>
            <div className="space-y-2">
              <Label>Job URL</Label>
              <Input
                value={jobUrl}
                onChange={(e) => { setJobUrl(e.target.value); setPartialData(null); }}
                placeholder="https://www.linkedin.com/jobs/view/..."
              />
            </div>

            {!partialData && (
              <Button onClick={scrapeAndAdd} disabled={scraping || !jobUrl.trim()} className="w-full">
                {scraping ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting...
                  </>
                ) : (
                  "Import from URL"
                )}
              </Button>
            )}

            {partialData && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/5 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-sm text-muted-foreground">{partialData.message}</p>
                </div>
                <div className="space-y-2">
                  <Label>Company *</Label>
                  <Input value={partialForm.company} onChange={(e) => setPartialForm(f => ({ ...f, company: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Position *</Label>
                  <Input value={partialForm.position} onChange={(e) => setPartialForm(f => ({ ...f, position: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={partialForm.location} onChange={(e) => setPartialForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <Button onClick={submitPartialForm} className="w-full">
                  Save Application
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="file" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or JSON file with columns: <code className="text-xs bg-muted px-1 rounded">company, position, url, location, salary_min, salary_max, status, date_applied</code>
            </p>
            <div className="space-y-2">
              <Label>Select File</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileImport}
              />
            </div>

            {importResult && (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">
                  ✅ Imported {importResult.count} applications
                </p>
                {importResult.errors.length > 0 && (
                  <div className="text-destructive">
                    <p className="font-medium">Skipped rows:</p>
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p>...and {importResult.errors.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
