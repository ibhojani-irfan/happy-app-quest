import { useQuery } from "@tanstack/react-query";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Phone, Gift, XCircle, CalendarClock } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { STATUS_CONFIG, type ApplicationStatus } from "@/lib/constants";
import { format, subDays, parseISO } from "date-fns";

const PIE_COLORS = [
  "hsl(220, 10%, 70%)",   // wishlist
  "hsl(200, 80%, 50%)",   // applied
  "hsl(38, 92%, 50%)",    // phone_screen
  "hsl(230, 65%, 52%)",   // interview
  "hsl(142, 72%, 40%)",   // offer
  "hsl(142, 72%, 30%)",   // accepted
  "hsl(0, 72%, 51%)",     // rejected
];

export default function Dashboard() {
  const { user } = useAuth();

  const { data: applications = [] } = useQuery({
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

  const { data: reminders = [] } = useQuery({
    queryKey: ["upcoming-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_reminders")
        .select("*, applications(company, position)")
        .eq("is_completed", false)
        .gte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const total = applications.length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const offers = applications.filter((a) => a.status === "offer" || a.status === "accepted").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

  // Pie chart data
  const statusCounts = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    value: applications.filter((a) => a.status === key).length,
  })).filter((d) => d.value > 0);

  // Bar chart: applications per week (last 8 weeks)
  const weekData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = subDays(new Date(), (7 - i) * 7);
    const weekEnd = subDays(new Date(), (6 - i) * 7);
    const count = applications.filter((a) => {
      const d = parseISO(a.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    return { week: format(weekStart, "MMM d"), count };
  });

  const stats = [
    { label: "Total Applications", value: total, icon: Briefcase, accent: "text-primary" },
    { label: "Interviews", value: interviews, icon: Phone, accent: "text-info" },
    { label: "Offers", value: offers, icon: Gift, accent: "text-success" },
    { label: "Rejection Rate", value: `${rejectionRate}%`, icon: XCircle, accent: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-3 ${s.accent}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weekData}>
                <XAxis dataKey="week" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(230, 65%, 52%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications by Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {statusCounts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {statusCounts.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[Object.keys(STATUS_CONFIG).indexOf(
                        Object.entries(STATUS_CONFIG).find(([, v]) => v.label === statusCounts[i]?.name)?.[0] ?? "wishlist"
                      )]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-muted-foreground">No applications yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" /> Upcoming Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming reminders</p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <span className="font-medium">{r.title}</span>
                    <span className="ml-2 text-muted-foreground">
                      — {r.applications?.company} ({r.applications?.position})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(r.due_date), "MMM d, yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
