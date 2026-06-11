import { supabase } from "@/lib/supabase";
import type { MaintenanceForecast, MaintenanceForecastItem } from "@/types/premium";
import type { Appliance, MaintenanceItem, Repair } from "@/data/demoData";

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";

type ForecastContext = {
  propertyLabel: string;
  yearBuilt: string;
  maintenance: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  score: number;
};

function ruleBasedForecast(ctx: ForecastContext): { summary: string; items: MaintenanceForecastItem[]; annual_budget: string } {
  const items: MaintenanceForecastItem[] = [];

  for (const m of ctx.maintenance.filter((x) => x.status !== "Completed").slice(0, 6)) {
    items.push({
      title: m.title,
      category: m.category,
      dueWindow: m.nextDue || "Next 30 days",
      priority: m.priority === "high" ? "high" : m.status === "Overdue" ? "high" : "medium",
      estimatedCost: m.category === "HVAC" ? "$150–$400" : "$75–$250",
      reason: m.status === "Overdue" ? "Overdue maintenance task" : `Scheduled: ${m.status}`,
    });
  }

  for (const a of ctx.appliances.filter((x) => ["Fair", "Poor", "Replace Soon"].includes(x.condition)).slice(0, 4)) {
    items.push({
      title: `Replace ${a.name}`,
      category: a.category,
      dueWindow: "Next 6–18 months",
      priority: a.condition === "Replace Soon" || a.condition === "Poor" ? "high" : "medium",
      estimatedCost: `$${Math.round(parseFloat(a.purchasePrice.replace(/,/g, "") || "800") * 0.8)}–$${Math.round(parseFloat(a.purchasePrice.replace(/,/g, "") || "1200") * 1.2)}`,
      reason: `Appliance condition: ${a.condition}`,
    });
  }

  if (items.length === 0) {
    items.push(
      {
        title: "HVAC Filter Replacement",
        category: "HVAC",
        dueWindow: "Next 60 days",
        priority: "medium",
        estimatedCost: "$25–$75",
        reason: "Standard seasonal maintenance for homes built " + (ctx.yearBuilt || "recently"),
      },
      {
        title: "Gutter Cleaning",
        category: "Exterior",
        dueWindow: "Next 90 days",
        priority: "low",
        estimatedCost: "$150–$300",
        reason: "Prevent water damage and foundation issues",
      }
    );
  }

  const budget = items.length * 200 + ctx.repairs.length * 150;
  return {
    summary: `Based on ${ctx.propertyLabel}'s maintenance schedule, appliance ages, and repair history (Health Score: ${ctx.score}/100), we forecast ${items.length} priority items over the next 12 months.`,
    items,
    annual_budget: `$${budget.toLocaleString()}–$${(budget * 1.4).toLocaleString()}`,
  };
}

async function aiForecast(ctx: ForecastContext): Promise<{ summary: string; items: MaintenanceForecastItem[]; annual_budget: string } | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const prompt = `Analyze this home and return ONLY valid JSON with keys: summary (string), annual_budget (string like "$2,400–$3,600"), items (array of {title, category, dueWindow, priority (low|medium|high), estimatedCost, reason}).

Property: ${ctx.propertyLabel}, built ${ctx.yearBuilt}, score ${ctx.score}/100
Maintenance: ${ctx.maintenance.map((m) => `${m.title} (${m.status}, due ${m.nextDue})`).join("; ")}
Repairs: ${ctx.repairs.map((r) => `${r.title} $${r.cost}`).join("; ")}
Appliances: ${ctx.appliances.map((a) => `${a.name} ${a.condition}`).join("; ")}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.map((b: { text?: string }) => b.text ?? "").join("") ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export async function generateMaintenanceForecast(
  userId: string,
  propertyId: string,
  ctx: ForecastContext
): Promise<MaintenanceForecast> {
  const ai = await aiForecast(ctx);
  const result = ai ?? ruleBasedForecast(ctx);

  const { data, error } = await supabase
    .from("maintenance_forecasts")
    .upsert(
      {
        user_id: userId,
        property_id: propertyId,
        summary: result.summary,
        items: result.items,
        annual_budget: result.annual_budget,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,property_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    ...(data as MaintenanceForecast),
    items: (data.items as MaintenanceForecastItem[]) ?? [],
  };
}

export async function fetchMaintenanceForecast(
  userId: string,
  propertyId: string
): Promise<MaintenanceForecast | null> {
  const { data, error } = await supabase
    .from("maintenance_forecasts")
    .select("*")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...(data as MaintenanceForecast),
    items: (data.items as MaintenanceForecastItem[]) ?? [],
  };
}
