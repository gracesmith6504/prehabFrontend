import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is a coach
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check caller role
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (callerProfile?.role !== "coach") {
      return new Response(JSON.stringify({ error: "Coach only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if demo data already seeded (look for demo athletes linked to this coach)
    const { data: existing } = await admin
      .from("athlete_profiles")
      .select("id")
      .eq("coach_id", user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Demo data already seeded for this coach" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create 5 demo athletes ──
    const athletes = [
      { email: "sara.demo@cycleagent.test", name: "Sara Jensen", riskProfile: "high" },
      { email: "maya.demo@cycleagent.test", name: "Maya Torres", riskProfile: "medium" },
      { email: "emma.demo@cycleagent.test", name: "Emma Liu", riskProfile: "low" },
      { email: "alex.demo@cycleagent.test", name: "Alex Novak", riskProfile: "medium" },
      { email: "priya.demo@cycleagent.test", name: "Priya Sharma", riskProfile: "low" },
    ];

    const athleteIds: string[] = [];

    for (const a of athletes) {
      // Create auth user
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: a.email,
        password: "DemoPass123!",
        email_confirm: true,
        user_metadata: { full_name: a.name },
      });

      if (authErr) {
        // If user exists, find their ID
        const { data: listData } = await admin.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u: any) => u.email === a.email);
        if (existingUser) {
          athleteIds.push(existingUser.id);
          continue;
        }
        throw authErr;
      }

      const uid = authData.user.id;
      athleteIds.push(uid);

      // Update profile with name (trigger creates profile + athlete_profile)
      await admin
        .from("profiles")
        .update({ full_name: a.name, role: "athlete" })
        .eq("user_id", uid);
    }

    // ── Assign athletes to this coach + set cycle profiles ──
    const cycleConfigs = [
      { cycleStart: daysAgo(5), cycleLen: 28, menLen: 5, contraceptive: false },
      { cycleStart: daysAgo(14), cycleLen: 30, menLen: 4, contraceptive: false },
      { cycleStart: daysAgo(22), cycleLen: 26, menLen: 5, contraceptive: true },
      { cycleStart: daysAgo(10), cycleLen: 28, menLen: 6, contraceptive: false },
      { cycleStart: daysAgo(18), cycleLen: 29, menLen: 5, contraceptive: false },
    ];

    for (let i = 0; i < athleteIds.length; i++) {
      await admin
        .from("athlete_profiles")
        .update({
          coach_id: user.id,
          cycle_start_date: cycleConfigs[i].cycleStart,
          cycle_length: cycleConfigs[i].cycleLen,
          menstruation_length: cycleConfigs[i].menLen,
          contraceptive_use: cycleConfigs[i].contraceptive,
        })
        .eq("user_id", athleteIds[i]);
    }

    // ── Training sessions (7-14 per athlete) ──
    const sessionTypes = ["Strength", "Speed", "Endurance", "Technical", "Match", "Recovery"];
    const intensities = ["Low", "Medium", "High"];

    for (let i = 0; i < athleteIds.length; i++) {
      const numSessions = 7 + Math.floor(Math.random() * 8); // 7-14
      const sessions = [];

      for (let s = 0; s < numSessions; s++) {
        const isHighRisk = athletes[i].riskProfile === "high";
        const rpe = isHighRisk
          ? 7 + Math.floor(Math.random() * 3) // 7-9
          : 3 + Math.floor(Math.random() * 5); // 3-7
        const intensity = isHighRisk
          ? "High"
          : intensities[Math.floor(Math.random() * intensities.length)];
        const duration = isHighRisk
          ? 80 + Math.floor(Math.random() * 40) // 80-120
          : 40 + Math.floor(Math.random() * 50); // 40-90

        sessions.push({
          athlete_id: athleteIds[i],
          date: daysAgo(s),
          sport: "Football",
          session_type: sessionTypes[Math.floor(Math.random() * sessionTypes.length)],
          duration,
          intensity,
          rpe,
        });
      }

      await admin.from("training_sessions").insert(sessions);
    }

    // ── Soreness logs (3-7 per athlete) ──
    for (let i = 0; i < athleteIds.length; i++) {
      const numLogs = 3 + Math.floor(Math.random() * 5); // 3-7
      const logs = [];
      const isHighRisk = athletes[i].riskProfile === "high";

      for (let s = 0; s < numLogs; s++) {
        logs.push({
          athlete_id: athleteIds[i],
          date: daysAgo(s),
          knee: isHighRisk ? 6 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 4),
          hamstring: isHighRisk ? 5 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3),
          groin: isHighRisk ? 4 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2),
          calf: isHighRisk ? 3 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2),
        });
      }

      await admin.from("soreness_logs").insert(logs);
    }

    // ── Weekly plans (1 per athlete) ──
    const defaultPlan = [
      { day: "Monday", type: "Strength", intensity: "High", duration: 75 },
      { day: "Tuesday", type: "Speed", intensity: "High", duration: 60 },
      { day: "Wednesday", type: "Recovery", intensity: "Low", duration: 30 },
      { day: "Thursday", type: "Technical", intensity: "Medium", duration: 60 },
      { day: "Friday", type: "Match Prep", intensity: "High", duration: 90 },
      { day: "Saturday", type: "Match", intensity: "High", duration: 90 },
      { day: "Sunday", type: "Rest", intensity: "Low", duration: 0 },
    ];

    for (let i = 0; i < athleteIds.length; i++) {
      const isHighRisk = athletes[i].riskProfile === "high";
      const adjusted = isHighRisk
        ? defaultPlan.map((d) => ({
            ...d,
            intensity: d.intensity === "High" ? "Medium" : d.intensity,
            duration: d.intensity === "High" ? Math.round(d.duration * 0.7) : d.duration,
            notes: d.intensity === "High" ? "Reduced due to elevated risk" : undefined,
          }))
        : defaultPlan;

      const riskScore = isHighRisk ? 82 : athletes[i].riskProfile === "medium" ? 55 : 25;
      const riskLevel = isHighRisk ? "High" : athletes[i].riskProfile === "medium" ? "Medium" : "Low";

      await admin.from("weekly_plans").insert({
        athlete_id: athleteIds[i],
        original_plan: defaultPlan,
        adjusted_plan: adjusted,
        risk_score: riskScore,
        risk_level: riskLevel,
        explanation: isHighRisk
          ? "Risk elevated due to high training load during luteal phase with significant soreness. Sessions reduced."
          : `Risk ${riskLevel.toLowerCase()}. Plan maintained with minor adjustments.`,
      });
    }

    // ── Risk reports (1 per athlete) ──
    for (let i = 0; i < athleteIds.length; i++) {
      const isHighRisk = athletes[i].riskProfile === "high";
      const isMedRisk = athletes[i].riskProfile === "medium";
      const riskScore = isHighRisk ? 85 : isMedRisk ? 52 : 22;

      await admin.from("risk_reports").insert({
        athlete_id: athleteIds[i],
        risk_score: riskScore,
        risk_level: isHighRisk ? "High" : isMedRisk ? "Medium" : "Low",
        phase: isHighRisk ? "luteal" : isMedRisk ? "ovulatory" : "follicular",
        phase_multiplier: isHighRisk ? 1.3 : isMedRisk ? 1.15 : 0.9,
        acute_chronic_ratio: isHighRisk ? 1.8 : isMedRisk ? 1.2 : 0.9,
        load_risk_multiplier: isHighRisk ? 1.5 : isMedRisk ? 1.1 : 1.0,
        soreness_contribution: isHighRisk ? 28 : isMedRisk ? 12 : 4,
        escalation_status: isHighRisk ? "escalated" : "none",
        explanation: isHighRisk
          ? "High risk: luteal phase + spike in training load (ACR 1.8) + elevated knee/hamstring soreness."
          : `${isHighRisk ? "High" : isMedRisk ? "Medium" : "Low"} risk. Monitoring recommended.`,
      });
    }

    // ── Risk predictions (1 per athlete) ──
    for (let i = 0; i < athleteIds.length; i++) {
      const isHighRisk = athletes[i].riskProfile === "high";
      const isMedRisk = athletes[i].riskProfile === "medium";
      const riskScore = isHighRisk ? 85 : isMedRisk ? 52 : 22;

      await admin.from("risk_predictions").insert({
        athlete_id: athleteIds[i],
        risk_score: riskScore,
        risk_prob: isHighRisk ? 0.87 : isMedRisk ? 0.45 : 0.15,
        risk_level: isHighRisk ? "High" : isMedRisk ? "Medium" : "Low",
        confidence: isHighRisk ? 0.92 : 0.85,
        predictor_type: "rules",
        model_version: "rules-v1",
        top_drivers: isHighRisk
          ? [
              { feature: "Acute:Chronic Ratio", value: 1.8, contribution: 0.35 },
              { feature: "Luteal Phase", value: "luteal", contribution: 0.25 },
              { feature: "Knee Soreness", value: 8, contribution: 0.22 },
              { feature: "Hamstring Soreness", value: 7, contribution: 0.18 },
            ]
          : [
              { feature: "Acute:Chronic Ratio", value: isMedRisk ? 1.2 : 0.9, contribution: 0.4 },
              { feature: "Phase", value: isMedRisk ? "ovulatory" : "follicular", contribution: 0.3 },
            ],
      });
    }

    // ── Escalations: 1 New (high-risk Sara) + 1 Acknowledged (medium-risk Maya) ──
    // Get risk_prediction IDs
    const { data: saraPred } = await admin
      .from("risk_predictions")
      .select("id")
      .eq("athlete_id", athleteIds[0])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: mayaPred } = await admin
      .from("risk_predictions")
      .select("id")
      .eq("athlete_id", athleteIds[1])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // New escalation for Sara (high-risk)
    await admin.from("escalations").insert({
      athlete_id: athleteIds[0],
      trigger_reason: "Risk score 85 exceeds threshold. ACR 1.8 during luteal phase with elevated soreness.",
      status: "open",
      risk_prediction_id: saraPred?.id || null,
    });

    // Acknowledged escalation for Maya (medium but spiked)
    await admin.from("escalations").insert({
      athlete_id: athleteIds[1],
      trigger_reason: "Risk score increased by 18 points in 48h. Ovulatory phase with rising training load.",
      status: "acknowledged",
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
      risk_prediction_id: mayaPred?.id || null,
      notes: "Monitoring closely. Reduced Friday session intensity.",
    });

    // ── Agent actions (a few per athlete for timeline) ──
    // Create a mock agent run
    const { data: agentRun } = await admin
      .from("agent_runs")
      .insert({
        trigger_type: "demo_seed",
        status: "completed",
        athletes_processed: 5,
        completed_at: new Date().toISOString(),
        model_version: "rules-v1",
      })
      .select("id")
      .single();

    const runId = agentRun?.id;
    if (runId) {
      const actionTypes = ["observe", "predict", "act", "justify"];
      for (let i = 0; i < athleteIds.length; i++) {
        const actions = actionTypes.map((t) => ({
          agent_run_id: runId,
          athlete_id: athleteIds[i],
          action_type: t,
          details:
            t === "predict"
              ? { risk_score: athletes[i].riskProfile === "high" ? 85 : athletes[i].riskProfile === "medium" ? 52 : 22 }
              : t === "act"
              ? { action: "adjust_plan", changes: athletes[i].riskProfile === "high" ? ["Reduced intensity", "Shortened duration"] : ["No changes"] }
              : { step: t },
        }));
        await admin.from("agent_actions").insert(actions);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        athletes_created: athleteIds.length,
        message: "Demo data seeded successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
