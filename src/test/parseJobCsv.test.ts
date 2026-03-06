import { describe, it, expect } from "vitest";
import { parseJobCsv, parseJobJson } from "@/lib/parseJobCsv";

describe("parseJobCsv", () => {
  it("parses valid CSV with all fields", () => {
    const csv = `company,position,url,location,salary_min,salary_max,status,date_applied
Google,Software Engineer,https://careers.google.com,Mountain View,120000,180000,applied,2026-01-15
Meta,Product Manager,,Remote,,,interview,2026-02-01`;

    const result = parseJobCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].company).toBe("Google");
    expect(result.valid[0].salary_min).toBe(120000);
    expect(result.valid[1].location).toBe("Remote");
    expect(result.valid[1].salary_min).toBeNull();
    expect(result.valid[1].status).toBe("interview");
  });

  it("returns error for missing required fields", () => {
    const csv = `company,position
,Software Engineer
Google,`;

    const result = parseJobCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("normalizes status aliases", () => {
    const csv = `company,position,status
Apple,Dev,submitted
Netflix,PM,screening
Amazon,SDE,onsite`;

    const result = parseJobCsv(csv);
    expect(result.valid[0].status).toBe("applied");
    expect(result.valid[1].status).toBe("phone_screen");
    expect(result.valid[2].status).toBe("interview");
  });

  it("handles quoted CSV fields with commas", () => {
    const csv = `company,position,location
"Acme, Inc.",Developer,"New York, NY"`;

    const result = parseJobCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].company).toBe("Acme, Inc.");
    expect(result.valid[0].location).toBe("New York, NY");
  });

  it("returns error for empty CSV", () => {
    const result = parseJobCsv("company,position");
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("defaults source to csv_import", () => {
    const csv = `company,position
Tesla,Engineer`;
    const result = parseJobCsv(csv);
    expect(result.valid[0].source).toBe("csv_import");
  });
});

describe("parseJobJson", () => {
  it("parses valid JSON array", () => {
    const json = JSON.stringify([
      { company: "Google", position: "SWE", location: "NYC", salary_min: 100000 },
      { company: "Meta", position: "PM" },
    ]);

    const result = parseJobJson(json);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].salary_min).toBe(100000);
    expect(result.valid[1].location).toBe("");
  });

  it("handles single object (not array)", () => {
    const json = JSON.stringify({ company: "Apple", position: "Designer" });
    const result = parseJobJson(json);
    expect(result.valid).toHaveLength(1);
  });

  it("returns error for invalid JSON", () => {
    const result = parseJobJson("not json");
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe("Invalid JSON");
  });

  it("validates required fields in JSON", () => {
    const json = JSON.stringify([{ company: "Google" }]);
    const result = parseJobJson(json);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("normalizes status in JSON", () => {
    const json = JSON.stringify([
      { company: "X", position: "Y", status: "Phone Screen" },
    ]);
    const result = parseJobJson(json);
    expect(result.valid[0].status).toBe("phone_screen");
  });
});
