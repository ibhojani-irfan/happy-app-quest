import type { Database } from "@/integrations/supabase/types";

export type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  wishlist: { label: "Wishlist", color: "bg-muted text-muted-foreground" },
  applied: { label: "Applied", color: "bg-info text-info-foreground" },
  phone_screen: { label: "Phone Screen", color: "bg-warning text-warning-foreground" },
  interview: { label: "Interview", color: "bg-primary text-primary-foreground" },
  offer: { label: "Offer", color: "bg-success text-success-foreground" },
  accepted: { label: "Accepted", color: "bg-success text-success-foreground" },
  rejected: { label: "Rejected", color: "bg-destructive text-destructive-foreground" },
};

export const ALL_STATUSES: ApplicationStatus[] = [
  "wishlist", "applied", "phone_screen", "interview", "offer", "accepted", "rejected",
];
