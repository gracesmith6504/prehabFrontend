// ============================================
// Paid.ai Signal — Agent-Native Usage Economics
// ============================================
// Tracks autonomous work performed, compute consumed,
// and economic value created by the PREHAB agent.
// Every signal proves measurable agent impact:
//   evaluations run, plans adjusted, escalations triggered,
//   compute cost incurred, and manual hours saved.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Whitelisted events — only measurable autonomous work
const ALLOWED_EVENTS = new Set([
  "agent_run",
  "risk_evaluation",
  "plan_adjustment",
  "escalation_created",
  "coach_override_accepted",
  "coach_override_modified",
  "coach_override_rejected",
]);

// Default economics by event type
// compute_cost_eur: actual compute consumed
// ml_calls: number of ML model invocations
// hours_saved_estimate: manual hours this replaces
// manual_value_eur_estimate: cost if done by a human (€40/hr physio rate)
const EVENT_ECONOMICS: Record<string, {
  compute_cost_eur: number;
  ml_calls: number;
  hours_saved_estimate: number;
  manual_value_eur_estimate: number;
}> = {
  agent_run: {
    compute_cost_eur: 0.03,
    ml_calls: 1,
    hours_saved_estimate: 0.5,
    manual_value_eur_estimate: 20,
  },
  risk_evaluation: {
    compute_cost_eur: 0.02,
    ml_calls: 1,
    hours_saved_estimate: 0.25,
    manual_value_eur_estimate: 10,
  },
  plan_adjustment: {
    compute_cost_eur: 0.05,
    ml_calls: 0,
    hours_saved_estimate: 0.75,
    manual_value_eur_estimate: 30,
  },
  escalation_created: {
    compute_cost_eur: 0.01,
    ml_calls: 0,
    hours_saved_estimate: 0.5,
    manual_value_eur_estimate: 20,
  },
  coach_override_accepted: {
    compute_cost_eur: 0.005,
    ml_calls: 0,
    hours_saved_estimate: 0.1,
    manual_value_eur_estimate: 4,
  },
  coach_override_modified: {
    compute_cost_eur: 0.005,
    ml_calls: 0,
    hours_saved_estimate: 0.1,
    manual_value_eur_estimate: 4,
  },
  coach_override_rejected: {
    compute_cost_eur: 0.005,
    ml_calls: 0,
    hours_saved_estimate: 0.1,
    manual_value_eur_estimate: 4,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── JWT Authentication ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized — missing bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized — invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Parse & validate request ──
    const body = await req.json();
    const {
      event_name,
      athlete_id,
      details = {},
    } = body;

    if (!event_name || !athlete_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: event_name, athlete_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Event whitelist — reject unknown events ──
    if (!ALLOWED_EVENTS.has(event_name)) {
      console.warn(`[Paid.ai] Rejected unknown event: ${event_name}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Event '${event_name}' is not a tracked agent action. Allowed: ${[...ALLOWED_EVENTS].join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Paid.ai API key ──
    const apiKey = Deno.env.get("PAID_API_KEY");
    if (!apiKey) {
      console.log(`[Paid.ai] PAID_API_KEY not set — skipping signal: ${event_name}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build economics metadata ──
    const baseEconomics = EVENT_ECONOMICS[event_name];
    const economics = {
      compute_cost_eur: details.compute_cost_eur ?? baseEconomics.compute_cost_eur,
      ml_calls: details.ml_calls ?? baseEconomics.ml_calls,
      plan_adjusted: details.plan_adjusted ?? (event_name === "plan_adjustment"),
      escalated: details.escalated ?? (event_name === "escalation_created"),
      hours_saved_estimate: details.hours_saved_estimate ?? baseEconomics.hours_saved_estimate,
      manual_value_eur_estimate: details.manual_value_eur_estimate ?? baseEconomics.manual_value_eur_estimate,
    };

    // ── Identifiers ──
    const orderId = `order_${athlete_id}_${new Date().toISOString().slice(0, 7).replace("-", "")}`;

    // ── Send signal to Paid.ai ──
    const resp = await fetch("https://api.agentpaid.io/api/v1/usage/v2/signals/bulk", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signals: [{
          event_name,
          agent_id: "prehab-agent",
          external_customer_id: athlete_id,
          external_product_id: orderId,
          data: {
            ...economics,
            ...details,
          },
        }],
      }),
    });

    if (!resp.ok) {
      const respBody = await resp.text();
      console.warn(`[Paid.ai] Signal failed [${resp.status}]: ${respBody}`);
      return new Response(
        JSON.stringify({ ok: false, error: respBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await resp.text();
    console.log(`[Paid.ai] Agent work tracked: ${event_name} | athlete=${athlete_id} | compute=€${economics.compute_cost_eur} | saved=${economics.hours_saved_estimate}h`);

    return new Response(
      JSON.stringify({ ok: true, event: event_name, economics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error(`[Paid.ai] Error: ${err.message}`);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
