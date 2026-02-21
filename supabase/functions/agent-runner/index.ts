import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================
// Risk Engine (server-side copy of core logic)
// ============================================
type MenstrualPhase = "menstruation" | "follicular" | "ovulatory" | "luteal" | "unknown";

const PHASE_MULTIPLIERS: Record<MenstrualPhase, number> = {
  menstruation: 1.0, follicular: 1.1, ovulatory: 1.4, luteal: 1.2, unknown: 1.0,
};

function getCurrentPhase(start: string | null, len: number, menLen: number): MenstrualPhase {
  if (!start) return "unknown";
  const diff = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
  const day = ((diff % len) + len) % len;
  if (day < menLen) return "menstruation";
  if (day < len * 0.4) return "follicular";
  if (day < len * 0.5) return "ovulatory";
  return "luteal";
}

function calcLoadScore(dur: number, rpe: number, intensity: string): number {
  const m = intensity === "High" ? 1.5 : intensity === "Medium" ? 1.0 : 0.6;
  return (dur * rpe * m) / 10;
}

function calcACR(sessions: any[]): number {
  const now = Date.now();
  let acute = 0, chronic = 0, count = 0;
  for (const s of sessions) {
    const d = new Date(s.date).getTime();
    const load = calcLoadScore(s.duration, s.rpe, s.intensity);
    if (d >= now - 7 * 86400000) acute += load;
    if (d >= now - 28 * 86400000) { chronic += load; count++; }
  }
  const weekAvg = count > 0 ? chronic / 4 : 0;
  if (weekAvg === 0) return acute > 0 ? 2.0 : 0;
  return acute / weekAvg;
}

function calcSoreness(logs: any[]): number {
  if (!logs.length) return 0;
  const l = logs[0];
  const max = Math.max(l.knee, l.hamstring, l.groin, l.calf, l.other_value || 0);
  let c = max * 10;
  if (logs.length >= 3) {
    const avg = (x: any) => (x.knee + x.hamstring + x.groin + x.calf) / 4;
    if (avg(logs[0]) > avg(logs[1]) && avg(logs[1]) > avg(logs[2])) c += 15;
  }
  return Math.min(c, 100);
}

function getLoadMult(r: number) { return r > 1.5 ? 1.5 : r > 1.2 ? 1.2 : 1.0; }

function calcRisk(phase: MenstrualPhase, acr: number, soreness: number) {
  const pm = PHASE_MULTIPLIERS[phase];
  const lm = getLoadMult(acr);
  const load = Math.min(acr / 2.0 * 100, 100) * 0.4;
  const phaseC = ((pm - 1.0) / 0.4) * 100 * 0.3;
  const soreC = soreness * 0.3;
  const score = Math.min(Math.round((load + phaseC + soreC) * lm * pm / 1.5), 100);
  const level = score > 80 ? "High" : score > 60 ? "Medium" : "Low";
  return { score, level, prob: score / 100 };
}

function computeDrivers(phase: MenstrualPhase, acr: number, soreness: number) {
  const pm = PHASE_MULTIPLIERS[phase];
  const phaseC = (pm - 1.0) / 0.4;
  const loadC = Math.min(acr / 2.0, 1);
  const soreC = soreness / 100;
  const total = phaseC + loadC + soreC || 1;
  return [
    { feature: "Acute:Chronic Ratio", value: acr, contribution: loadC / total },
    { feature: "Menstrual Phase", value: phase, contribution: phaseC / total },
    { feature: "Soreness", value: soreness, contribution: soreC / total },
  ].sort((a: any, b: any) => b.contribution - a.contribution);
}

// Plan generation
function defaultPlan() {
  return [
    { day: "Monday", type: "Strength", intensity: "Medium", duration: 60 },
    { day: "Tuesday", type: "Sprint", intensity: "High", duration: 45 },
    { day: "Wednesday", type: "Recovery", intensity: "Low", duration: 30 },
    { day: "Thursday", type: "Plyometrics", intensity: "High", duration: 50 },
    { day: "Friday", type: "Match", intensity: "High", duration: 90 },
    { day: "Saturday", type: "Recovery", intensity: "Low", duration: 30 },
    { day: "Sunday", type: "Rest", intensity: "Low", duration: 0 },
  ];
}

function adjustPlan(original: any[], riskScore: number) {
  const adjusted = original.map((s: any) => ({ ...s }));
  const changes: string[] = [];
  if (riskScore > 80) {
    adjusted.forEach((s: any) => {
      if (s.type === "Plyometrics" || s.type === "Sprint") {
        changes.push(`Replaced ${s.type} (${s.day}) with Recovery`);
        s.type = "Recovery"; s.intensity = "Low"; s.duration = 30;
        s.notes = "Risk too high — session replaced";
      }
      if (s.type === "Match") {
        changes.push(`Reduced Match intensity (${s.day}) to Medium`);
        s.intensity = "Medium"; s.notes = "Risk too high — reduced intensity";
      }
    });
  } else if (riskScore > 60) {
    adjusted.forEach((s: any) => {
      if (s.type === "Plyometrics") {
        const nd = Math.round(s.duration * 0.7);
        changes.push(`Reduced Plyometrics (${s.day}) from ${s.duration}min to ${nd}min`);
        s.duration = nd; s.notes = "Reduced volume due to elevated risk";
      }
      if (s.type === "Sprint" && s.intensity === "High") {
        changes.push(`Lowered Sprint intensity (${s.day}) to Medium`);
        s.intensity = "Medium"; s.notes = "Intensity lowered";
      }
    });
    const rest = adjusted.find((s: any) => s.type === "Rest");
    if (rest) {
      changes.push(`Added Stability session on ${rest.day}`);
      rest.type = "Strength"; rest.intensity = "Low"; rest.duration = 40;
      rest.notes = "Added stability-focused strength work";
    }
  }
  return { adjusted, changes };
}

function buildExplanation(phase: MenstrualPhase, score: number, acr: number, soreness: number, changes: string[]) {
  const parts: string[] = [];
  if (phase === "ovulatory") parts.push("Ovulatory phase — highest ACL injury risk.");
  else if (phase === "luteal") parts.push("Luteal phase — moderately elevated risk.");
  if (acr > 1.5) parts.push(`ACR (${acr.toFixed(2)}) indicates a training spike.`);
  if (soreness > 50) parts.push("Soreness levels significantly elevated.");
  if (changes.length) parts.push(`Adjustments: ${changes.join("; ")}.`);
  if (score > 80) parts.push("⚠️ Risk very high. Consult physio or coach.");
  return parts.join(" ") || "Risk within normal range.";
}

// ============================================
// Main handler
// ============================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Determine trigger type
  let triggerType = "manual";
  try {
    const body = await req.json();
    if (body?.trigger_type) triggerType = body.trigger_type;
  } catch { /* no body is fine */ }

  // Get active model version
  const { data: activeModel } = await supabase
    .from("model_registry")
    .select("version, predictor_type")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const modelVersion = activeModel?.version || "rules-v1.0";

  // Create agent run
  const { data: agentRun, error: runErr } = await supabase
    .from("agent_runs")
    .insert({ status: "running", trigger_type: triggerType, model_version: modelVersion })
    .select("id")
    .single();

  if (runErr || !agentRun) {
    return new Response(JSON.stringify({ error: "Failed to create agent run", details: runErr }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId = agentRun.id;
  const errors: any[] = [];
  let processed = 0;

  // Fetch all athletes
  const { data: athletes } = await supabase.from("athlete_profiles").select("*");

  for (const athlete of athletes || []) {
    try {
      const uid = athlete.user_id;

      // ===== 1. OBSERVE =====
      const phase = getCurrentPhase(athlete.cycle_start_date, athlete.cycle_length || 28, athlete.menstruation_length || 5);
      const since28 = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("date, duration, rpe, intensity")
        .eq("athlete_id", uid)
        .gte("date", since28);

      const { data: soreLogs } = await supabase
        .from("soreness_logs")
        .select("knee, hamstring, groin, calf, other_value")
        .eq("athlete_id", uid)
        .gte("date", since7)
        .order("date", { ascending: false });

      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "observe",
        details: { sessions_count: (sessions || []).length, soreness_logs_count: (soreLogs || []).length, phase },
      });

      // ===== 2. PREDICT =====
      const acr = calcACR(sessions || []);
      const sorenessC = calcSoreness(soreLogs || []);
      const risk = calcRisk(phase, acr, sorenessC);
      const topDrivers = computeDrivers(phase, acr, sorenessC);

      const { data: prediction } = await supabase
        .from("risk_predictions")
        .insert({
          athlete_id: uid, agent_run_id: runId,
          risk_prob: risk.prob, risk_score: risk.score, risk_level: risk.level,
          top_drivers: topDrivers, model_version: modelVersion,
          predictor_type: "rules", confidence: 1.0,
        })
        .select("id")
        .single();

      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "predict",
        details: { risk_score: risk.score, risk_level: risk.level, risk_prob: risk.prob, predictor_type: "rules" },
      });

      // ===== 3. PLAN =====
      const { data: existingPlan } = await supabase
        .from("weekly_plans")
        .select("id, original_plan, locked_by_coach")
        .eq("athlete_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Respect coach lock — skip plan adjustment if locked
      const planLocked = existingPlan?.locked_by_coach === true;

      const basePlan = existingPlan?.original_plan || defaultPlan();
      const { adjusted, changes } = planLocked
        ? { adjusted: existingPlan?.original_plan as any[] || defaultPlan(), changes: [] as string[] }
        : adjustPlan(basePlan as any[], risk.score);

      // ===== 4. ACT =====
      const explanation = planLocked
        ? buildExplanation(phase, risk.score, acr, sorenessC, []) + " (Plan locked by coach — no adjustments made.)"
        : buildExplanation(phase, risk.score, acr, sorenessC, changes);

      // Write risk report
      await supabase.from("risk_reports").insert({
        athlete_id: uid, risk_score: risk.score, risk_level: risk.level,
        phase, phase_multiplier: PHASE_MULTIPLIERS[phase],
        acute_chronic_ratio: acr, load_risk_multiplier: getLoadMult(acr),
        soreness_contribution: sorenessC, explanation,
        escalation_status: "none",
        agent_run_id: runId, risk_prediction_id: prediction?.id,
      });

      // Write/update weekly plan (skip update if locked)
      if (existingPlan && !planLocked) {
        await supabase.from("weekly_plans").update({
          adjusted_plan: adjusted, risk_score: risk.score,
          risk_level: risk.level, explanation, agent_run_id: runId,
        }).eq("id", existingPlan.id);
      } else if (!existingPlan) {
        await supabase.from("weekly_plans").insert({
          athlete_id: uid, original_plan: basePlan,
          adjusted_plan: adjusted, risk_score: risk.score,
          risk_level: risk.level, explanation, agent_run_id: runId,
        });
      }

      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "act",
        details: { changes, plan_updated: true, report_created: true },
      });

      // Auto-escalation check
      let shouldEscalate = false;
      let triggerReason = "";

      if (risk.level === "High") {
        shouldEscalate = true;
        triggerReason = `risk_level=High (score: ${risk.score})`;
      } else if (risk.prob > 0.8) {
        shouldEscalate = true;
        triggerReason = `risk_prob=${risk.prob.toFixed(2)} > 0.8`;
      }

      // Check 48h score spike
      if (!shouldEscalate) {
        const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString();
        const { data: recentPred } = await supabase
          .from("risk_predictions")
          .select("risk_score")
          .eq("athlete_id", uid)
          .lt("created_at", twoDaysAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentPred && risk.score - recentPred.risk_score >= 15) {
          shouldEscalate = true;
          triggerReason = `Score jumped +${risk.score - recentPred.risk_score} in 48h`;
        }
      }

      if (shouldEscalate) {
        await supabase.from("escalations").insert({
          athlete_id: uid, agent_run_id: runId,
          risk_prediction_id: prediction?.id,
          trigger_reason: triggerReason, status: "open",
        });
        await supabase.from("agent_actions").insert({
          agent_run_id: runId, athlete_id: uid, action_type: "escalate",
          details: { trigger_reason: triggerReason },
        });
      }

      // ===== 5. JUSTIFY =====
      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "justify",
        details: { explanation, top_drivers: topDrivers, changes },
      });

      processed++;
    } catch (err: any) {
      errors.push({ athlete_id: athlete.user_id, error: err.message });
    }
  }

  // Complete the agent run
  await supabase.from("agent_runs").update({
    status: errors.length ? "completed_with_errors" : "completed",
    completed_at: new Date().toISOString(),
    athletes_processed: processed,
    errors,
  }).eq("id", runId);

  return new Response(
    JSON.stringify({ run_id: runId, athletes_processed: processed, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
