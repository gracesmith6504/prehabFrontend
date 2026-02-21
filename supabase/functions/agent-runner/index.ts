import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================
// Feature computation helpers
// ============================================

function getCycleDayInt(start: string | null, cycleLen: number): number {
  if (!start) return 0;
  const diff = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
  return ((diff % cycleLen) + cycleLen) % cycleLen;
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

function computeWeeklyLoad(sessions: any[]): number {
  const now = Date.now();
  let total = 0;
  for (const s of sessions) {
    if (new Date(s.date).getTime() >= now - 7 * 86400000) {
      total += calcLoadScore(s.duration, s.rpe, s.intensity);
    }
  }
  return total;
}

function computeDaysSinceLastRest(sessions: any[]): number {
  if (!sessions.length) return 0;
  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let consecutive = 0;
  for (let i = 0; i < 28; i++) {
    const checkDate = new Date(today.getTime() - i * 86400000).toISOString().split("T")[0];
    if (sorted.some((s: any) => s.date === checkDate)) {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}

function buildLast7DaysSoreness(soreLogs: any[]): number[] {
  const result: number[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const dateStr = new Date(today.getTime() - i * 86400000).toISOString().split("T")[0];
    const dayLog = soreLogs.find((l: any) => l.date === dateStr);
    if (dayLog) {
      result.push(Math.round((dayLog.knee + dayLog.hamstring + dayLog.groin + dayLog.calf) / 4));
    } else {
      result.push(0);
    }
  }
  return result;
}

function buildLast7DaysLoad(sessions: any[]): number[] {
  const result: number[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const dateStr = new Date(today.getTime() - i * 86400000).toISOString().split("T")[0];
    const daySessions = sessions.filter((s: any) => s.date === dateStr);
    const dayLoad = daySessions.reduce((sum: number, s: any) => sum + calcLoadScore(s.duration, s.rpe, s.intensity), 0);
    result.push(Math.round(dayLoad * 100) / 100);
  }
  return result;
}

// ============================================
// ML service caller
// ============================================

interface AnalysisResponse {
  risk_profile: {
    acl_risk: number;
    soft_tissue_risk: number;
    overtraining_risk: number;
    recovery_status: number;
    performance_readiness: number;
  };
  trend_analysis: {
    load_trajectory: string;
    soreness_trajectory: string;
    cycle_risk_window: string;
    acute_chronic_ratio: number;
  };
  contributing_factors: { factor: string; contribution: number; label: string }[];
  confidence: number;
  composite_risk_level: string;
  recommended_actions: string[];
  injury_window_forecast: {
    next_3_days: string;
    next_7_days: string;
    next_14_days: string;
  };
  explanation: string | null;
}

async function callMLService(mlUrl: string, payload: any): Promise<AnalysisResponse> {
  const url = `${mlUrl.replace(/\/+$/, '')}/analyse/`;
  const bodyStr = JSON.stringify(payload);
  console.log(`[DEBUG] Calling ML service: ${url}`);
  console.log(`[DEBUG] Payload: ${bodyStr}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });
  const respBody = await resp.text();
  console.log(`[DEBUG] ML response status: ${resp.status}`);
  console.log(`[DEBUG] ML response body: ${respBody}`);
  if (!resp.ok) {
    throw new Error(`ML service returned ${resp.status}: ${respBody}`);
  }
  return JSON.parse(respBody);
}

function mapRiskLevel(composite: string): "Low" | "Medium" | "High" {
  const lower = composite.toLowerCase();
  if (lower.includes("high") || lower.includes("critical") || lower.includes("severe")) return "High";
  if (lower.includes("medium") || lower.includes("moderate") || lower.includes("elevated")) return "Medium";
  return "Low";
}

// ============================================
// Plan generation (unchanged from original)
// ============================================

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

// ============================================
// Main handler
// ============================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const mlEndpointUrl = Deno.env.get("ML_ENDPOINT_URL");
  if (!mlEndpointUrl) {
    return new Response(JSON.stringify({ error: "ML_ENDPOINT_URL not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Determine trigger type and coach_id
  let triggerType = "manual";
  let coachId: string | null = null;
  try {
    const body = await req.json();
    if (body?.trigger_type) triggerType = body.trigger_type;
    if (body?.coach_id) coachId = body.coach_id;
  } catch { /* no body is fine */ }

  // If no coach_id in body, try to get it from the auth header
  if (!coachId) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const { createClient: createAnonClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const anonSupabase = createAnonClient(anonUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await anonSupabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
        if (profile?.role === "coach") {
          coachId = user.id;
        }
      }
    }
  }

  // Get active model version
  const { data: activeModel } = await supabase
    .from("model_registry")
    .select("version, predictor_type")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const modelVersion = activeModel?.version || "cloudrun-v1.0";

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

  // Fetch athletes — scoped to coach if coach_id is available
  let athleteQuery = supabase.from("athlete_profiles").select("*");
  if (coachId) {
    athleteQuery = athleteQuery.eq("coach_id", coachId);
  }
  const { data: athletes } = await athleteQuery;

  for (const athlete of athletes || []) {
    try {
      const uid = athlete.user_id;

      // ===== 1. OBSERVE =====
      const cycleDay = getCycleDayInt(athlete.cycle_start_date, athlete.cycle_length || 28);
      const since28 = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("date, duration, rpe, intensity")
        .eq("athlete_id", uid)
        .gte("date", since28);

      const { data: soreLogs } = await supabase
        .from("soreness_logs")
        .select("date, knee, hamstring, groin, calf, other_value")
        .eq("athlete_id", uid)
        .gte("date", since7)
        .order("date", { ascending: false });

      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "observe",
        details: { sessions_count: (sessions || []).length, soreness_logs_count: (soreLogs || []).length, cycle_day: cycleDay },
      });

      // ===== 2. BUILD ML PAYLOAD =====
      const acr = calcACR(sessions || []);
      const latestSore = (soreLogs && soreLogs.length > 0) ? soreLogs[0] : null;
      const latestSession = sessions && sessions.length > 0
        ? [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null;

      const athleteInput = {
        athlete_id: uid,
        cycle_phase: cycleDay,
        acute_chronic_ratio: Math.round(acr * 100) / 100,
        knee_soreness: latestSore?.knee ?? 0,
        hamstring_soreness: latestSore?.hamstring ?? 0,
        groin_soreness: latestSore?.groin ?? 0,
        session_rpe: latestSession?.rpe ?? 5,
        weekly_load: computeWeeklyLoad(sessions || []),
        days_since_last_rest: computeDaysSinceLastRest(sessions || []),
        last_7_days_soreness: buildLast7DaysSoreness(soreLogs || []),
        last_7_days_load: buildLast7DaysLoad(sessions || []),
        previous_injuries: [],
        total_injuries_past_year: 0,
        days_since_last_injury: 0,
      };

      // ===== 3. CALL ML SERVICE =====
      let mlResponse: AnalysisResponse;
      try {
        mlResponse = await callMLService(mlEndpointUrl, athleteInput);
      } catch (mlErr: any) {
        const errMsg = `ML service error for athlete ${uid}: ${mlErr.message}`;
        console.error(errMsg);
        errors.push({ athlete_id: uid, error: errMsg });
        await supabase.from("agent_actions").insert({
          agent_run_id: runId, athlete_id: uid, action_type: "predict",
          details: { error: errMsg, predictor_type: "ml", status: "failed" },
        });
        continue; // Skip this athlete — no fallback
      }

      // ===== MAP ML RESPONSE =====
      const riskProb = mlResponse.risk_profile.acl_risk;
      const riskScore = Math.round(riskProb * 100);
      const riskLevel = mapRiskLevel(mlResponse.composite_risk_level);
      const topDrivers = mlResponse.contributing_factors.map(f => ({
        feature: f.factor,
        value: f.contribution,
        contribution: f.contribution,
        label: f.label,
      }));
      const confidence = mlResponse.confidence;

      // ===== 4. PREDICT (store) =====
      const { data: prediction } = await supabase
        .from("risk_predictions")
        .insert({
          athlete_id: uid, agent_run_id: runId,
          risk_prob: riskProb, risk_score: riskScore, risk_level: riskLevel,
          top_drivers: topDrivers, model_version: modelVersion,
          predictor_type: "ml", confidence,
        })
        .select("id")
        .single();

      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "predict",
        details: {
          risk_score: riskScore, risk_level: riskLevel, risk_prob: riskProb,
          predictor_type: "ml", confidence,
          composite_risk_level: mlResponse.composite_risk_level,
        },
      });

      // ===== 5. PLAN =====
      const { data: existingPlan } = await supabase
        .from("weekly_plans")
        .select("id, original_plan, locked_by_coach")
        .eq("athlete_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const planLocked = existingPlan?.locked_by_coach === true;
      const basePlan = existingPlan?.original_plan || defaultPlan();
      const { adjusted, changes } = planLocked
        ? { adjusted: existingPlan?.original_plan as any[] || defaultPlan(), changes: [] as string[] }
        : adjustPlan(basePlan as any[], riskScore);

      // ===== 6. ACT =====
      // Build explanation from ML response
      const explanationParts: string[] = [];
      if (mlResponse.explanation) explanationParts.push(mlResponse.explanation);
      if (mlResponse.recommended_actions?.length) {
        explanationParts.push(`Recommended: ${mlResponse.recommended_actions.join("; ")}.`);
      }
      if (planLocked) explanationParts.push("(Plan locked by coach — no adjustments made.)");
      else if (changes.length) explanationParts.push(`Adjustments: ${changes.join("; ")}.`);
      const explanation = explanationParts.join(" ") || `Risk ${riskLevel} (score: ${riskScore}).`;

      // Compute phase name for risk_reports.phase column
      const phaseDay = cycleDay;
      const cycleLen = athlete.cycle_length || 28;
      const menLen = athlete.menstruation_length || 5;
      let phaseName = "unknown";
      if (athlete.cycle_start_date) {
        if (phaseDay < menLen) phaseName = "menstruation";
        else if (phaseDay < cycleLen * 0.4) phaseName = "follicular";
        else if (phaseDay < cycleLen * 0.5) phaseName = "ovulatory";
        else phaseName = "luteal";
      }

      // Write risk report
      await supabase.from("risk_reports").insert({
        athlete_id: uid, risk_score: riskScore, risk_level: riskLevel,
        phase: phaseName, phase_multiplier: 1.0,
        acute_chronic_ratio: acr, load_risk_multiplier: 1.0,
        soreness_contribution: latestSore ? Math.max(latestSore.knee, latestSore.hamstring, latestSore.groin, latestSore.calf) * 10 : 0,
        explanation,
        escalation_status: "none",
        agent_run_id: runId, risk_prediction_id: prediction?.id,
      });

      // Write/update weekly plan
      if (existingPlan && !planLocked) {
        await supabase.from("weekly_plans").update({
          adjusted_plan: adjusted, risk_score: riskScore,
          risk_level: riskLevel, explanation, agent_run_id: runId,
        }).eq("id", existingPlan.id);
      } else if (!existingPlan) {
        await supabase.from("weekly_plans").insert({
          athlete_id: uid, original_plan: basePlan,
          adjusted_plan: adjusted, risk_score: riskScore,
          risk_level: riskLevel, explanation, agent_run_id: runId,
        });
      }

      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "act",
        details: { changes, plan_updated: true, report_created: true },
      });

      // Auto-escalation check
      let shouldEscalate = false;
      let triggerReason = "";

      if (riskLevel === "High") {
        shouldEscalate = true;
        triggerReason = `risk_level=High (score: ${riskScore})`;
      } else if (riskProb > 0.8) {
        shouldEscalate = true;
        triggerReason = `risk_prob=${riskProb.toFixed(2)} > 0.8`;
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
        if (recentPred && riskScore - Number(recentPred.risk_score) >= 15) {
          shouldEscalate = true;
          triggerReason = `Score jumped +${riskScore - Number(recentPred.risk_score)} in 48h`;
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

      // ===== 7. JUSTIFY =====
      await supabase.from("agent_actions").insert({
        agent_run_id: runId, athlete_id: uid, action_type: "justify",
        details: {
          explanation, top_drivers: topDrivers, changes,
          ml_confidence: confidence,
          injury_forecast: mlResponse.injury_window_forecast,
          trend_analysis: mlResponse.trend_analysis,
        },
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
