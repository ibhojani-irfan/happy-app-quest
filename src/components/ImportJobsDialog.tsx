import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link2, FileUp, Loader2 } from "lucide-react";
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

  // File tab state
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);

  const scrapeAndAdd = async () => {
    if (!jobUrl.trim()) return;
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-job-url", {
        body: { url: jobUrl.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to scrape");

      const job = data.data;
      const { error: insertError } = await supabase.from("applications").insert({
        company: job.company || "Unknown Company",
        position: job.position || "Unknown Position",
        url: job.url || null,
        location: job.location || null,
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        status: "applied" as ApplicationStatus,
        source: job.source || "manual",
        user_id: user!.id,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(`Added: ${job.position} at ${job.company}`);
      setJobUrl("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to import from URL");
    } finally {
      setScraping(false);
    }
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Jobs</DialogTitle>
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
              Paste a LinkedIn or Seek job listing URL and we'll auto-fill the details.
            </p>
            <div className="space-y-2">
              <Label>Job URL</Label>
              <Input
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/..."
              />
            </div>
            <Button onClick={scrapeAndAdd} disabled={scraping || !jobUrl.trim()} className="w-full">
              {scraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting...
                </>
              ) : (
                "Import from URL"
              )}
            </Button>
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
