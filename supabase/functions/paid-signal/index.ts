import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_name, athlete_id, details } = await req.json();

    const apiKey = Deno.env.get("PAID_API_KEY");
    if (!apiKey) {
      console.log(`[Paid.ai] PAID_API_KEY not set — skipping signal: ${event_name}`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orderId = `order_${athlete_id}_${new Date().toISOString().slice(0, 7).replace("-", "")}`;

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
          data: details || {},
        }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[Paid.ai] Signal failed [${resp.status}]: ${body}`);
      return new Response(JSON.stringify({ ok: false, error: body }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await resp.text();
    console.log(`[Paid.ai] Signal recorded: ${event_name} for ${athlete_id}`);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(`[Paid.ai] Error: ${err.message}`);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
