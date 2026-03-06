import { z } from "zod";
import type { ApplicationStatus } from "@/lib/constants";

const VALID_STATUSES: ApplicationStatus[] = [
  "wishlist", "applied", "phone_screen", "interview", "offer", "accepted", "rejected",
];

export const csvRowSchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  position: z.string().trim().min(1, "Position is required"),
  url: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
  salary_min: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().nullable()),
  salary_max: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().nullable()),
  status: z.string().trim().optional().default("applied"),
  date_applied: z.string().trim().optional().default(""),
  source: z.string().trim().optional().default("csv_import"),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export interface ParseResult {
  valid: CsvRow[];
  errors: { row: number; message: string }[];
}

/**
 * Parse CSV text into job application rows.
 * Expects first line as headers, comma-separated.
 */
export function parseJobCsv(text: string): ParseResult {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));
  const valid: CsvRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });

    // Normalize status
    if (obj.status) {
      obj.status = normalizeStatus(obj.status);
    }

    const result = csvRowSchema.safeParse(obj);
    if (result.success) {
      valid.push(result.data);
    } else {
      const msg = result.error.issues.map((issue) => issue.message).join("; ");
      errors.push({ row: i + 1, message: msg });
    }
  }

  return { valid, errors };
}

/**
 * Parse JSON array text into job application rows.
 */
export function parseJobJson(text: string): ParseResult {
  let arr: unknown[];
  try {
    const parsed = JSON.parse(text);
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { valid: [], errors: [{ row: 0, message: "Invalid JSON" }] };
  }

  const valid: CsvRow[] = [];
  const errors: { row: number; message: string }[] = [];

  arr.forEach((item, i) => {
    const obj = item as Record<string, unknown>;
    if (obj.status && typeof obj.status === "string") {
      obj.status = normalizeStatus(obj.status);
    }
    const result = csvRowSchema.safeParse(obj);
    if (result.success) {
      valid.push(result.data);
    } else {
      const msg = result.error.issues.map((issue) => issue.message).join("; ");
      errors.push({ row: i + 1, message: msg });
    }
  });

  return { valid, errors };
}

function normalizeStatus(raw: string): string {
  const normalized = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (VALID_STATUSES.includes(normalized as ApplicationStatus)) return normalized;
  // Common aliases
  if (normalized === "applied_online" || normalized === "submitted") return "applied";
  if (normalized === "screening" || normalized === "phone") return "phone_screen";
  if (normalized === "onsite" || normalized === "technical") return "interview";
  return "applied"; // fallback
}

/** Simple CSV line parser that handles quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
