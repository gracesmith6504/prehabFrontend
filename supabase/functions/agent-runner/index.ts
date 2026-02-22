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

async function callML(mlUrl: string, payload: any): Promise<AnalysisResponse> {
  const url = `${mlUrl.replace(/\/+$/, '')}/analyse/`;
  console.log(`[THINK] Calling ML service: ${url}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const respBody = await resp.text();
  console.log(`[THINK] ML response status: ${resp.status}`);
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
// AGENT TOOL: logAction
// ============================================

async function logAction(supabase: any, runId: string, athleteId: string, actionType: string, details: any) {
  await supabase.from("agent_actions").insert({
    agent_run_id: runId,
    athlete_id: athleteId,
    action_type: actionType,
    details,
  });
}

// ============================================
// AGENT TOOL: getAthleteState (OBSERVE)
// ============================================

async function getAthleteState(supabase: any, athlete: any) {
  const uid = athlete.user_id;
  const since28 = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [sessRes, soreRes] = await Promise.all([
    supabase.from("training_sessions").select("date, duration, rpe, intensity").eq("athlete_id", uid).gte("date", since28),
    supabase.from("soreness_logs").select("date, knee, hamstring, groin, calf, other_value").eq("athlete_id", uid).gte("date", since7).order("date", { ascending: false }),
  ]);

  const sessions = sessRes.data || [];
  const soreLogs = soreRes.data || [];
  const cycleDay = getCycleDayInt(athlete.cycle_start_date, athlete.cycle_length || 28);
  const acr = calcACR(sessions);
  const latestSore = soreLogs.length > 0 ? soreLogs[0] : null;
  const latestSession = sessions.length > 0
    ? [...sessions].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Compute phase name
  const cycleLen = athlete.cycle_length || 28;
  const menLen = athlete.menstruation_length || 5;
  let phaseName = "unknown";
  if (athlete.cycle_start_date) {
    if (cycleDay < menLen) phaseName = "menstruation";
    else if (cycleDay < cycleLen * 0.4) phaseName = "follicular";
    else if (cycleDay < cycleLen * 0.5) phaseName = "ovulatory";
    else phaseName = "luteal";
  }

  return {
    uid, sessions, soreLogs, cycleDay, acr, latestSore, latestSession, phaseName,
    autonomyLevel: athlete.autonomy_level || "auto_adjust",
    athleteInput: {
      athlete_id: uid,
      cycle_phase: cycleDay,
      acute_chronic_ratio: Math.round(acr * 100) / 100,
      knee_soreness: latestSore?.knee ?? 0,
      hamstring_soreness: latestSore?.hamstring ?? 0,
      groin_soreness: latestSore?.groin ?? 0,
      session_rpe: latestSession?.rpe ?? 5,
      weekly_load: computeWeeklyLoad(sessions),
      days_since_last_rest: computeDaysSinceLastRest(sessions),
      last_7_days_soreness: buildLast7DaysSoreness(soreLogs),
      last_7_days_load: buildLast7DaysLoad(sessions),
      previous_injuries: [],
      total_injuries_past_year: 0,
      days_since_last_injury: 0,
    },
  };
}

// ============================================
// AGENT TOOL: getAgentMemory
// ============================================

async function getAgentMemory(supabase: any, athleteId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [predRes, overrideRes, feedbackRes] = await Promise.all([
    supabase.from("risk_predictions").select("risk_score, risk_level, created_at").eq("athlete_id", athleteId).order("created_at", { ascending: false }).limit(3),
    supabase.from("coach_override_events").select("id").eq("athlete_id", athleteId).gte("created_at", sevenDaysAgo),
    supabase.from("feedback_events").select("feedback_type").eq("athlete_id", athleteId).gte("created_at", sevenDaysAgo),
  ]);

  const last3Scores = (predRes.data || []).map((p: any) => Number(p.risk_score));
  const overrideCount7d = (overrideRes.data || []).length;
  const feedbackEvents = feedbackRes.data || [];
  const acceptCount = feedbackEvents.filter((f: any) => f.feedback_type === "accepted").length;
  const rejectCount = feedbackEvents.filter((f: any) => f.feedback_type === "rejected").length;
  const totalFeedback = acceptCount + rejectCount;

  // Determine trend from last 3 scores
  let predictionTrend: "improving" | "worsening" | "stable" | "insufficient_data" = "insufficient_data";
  if (last3Scores.length >= 2) {
    const newest = last3Scores[0];
    const oldest = last3Scores[last3Scores.length - 1];
    const diff = newest - oldest;
    if (diff > 5) predictionTrend = "worsening";
    else if (diff < -5) predictionTrend = "improving";
    else predictionTrend = "stable";
  }

  return {
    last3Scores,
    predictionTrend,
    overrideCount7d,
    feedbackRatio: totalFeedback > 0 ? acceptCount / totalFeedback : null,
    acceptCount,
    rejectCount,
  };
}

// ============================================
// AGENT TOOL: adjustPlanByAutonomy
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

function adjustPlanByAutonomy(original: any[], riskScore: number, autonomyLevel: string, planLocked: boolean) {
  // If suggest_only or escalate, don't modify plan
  if (autonomyLevel === "suggest_only" || autonomyLevel === "escalate" || planLocked) {
    return { adjusted: original.map((s: any) => ({ ...s })), changes: [] as string[], planModified: false };
  }

  // auto_adjust: apply risk-based adjustments
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

  return { adjusted, changes, planModified: changes.length > 0 };
}

// ============================================
// AGENT TOOL: writeRiskReport
// ============================================

async function writeRiskReport(supabase: any, params: {
  uid: string; riskScore: number; riskLevel: string; phaseName: string;
  acr: number; latestSore: any; explanation: string;
  runId: string; predictionId: string | null;
}) {
  await supabase.from("risk_reports").insert({
    athlete_id: params.uid,
    risk_score: params.riskScore,
    risk_level: params.riskLevel,
    phase: params.phaseName,
    phase_multiplier: 1.0,
    acute_chronic_ratio: params.acr,
    load_risk_multiplier: 1.0,
    soreness_contribution: params.latestSore
      ? Math.max(params.latestSore.knee, params.latestSore.hamstring, params.latestSore.groin, params.latestSore.calf) * 10
      : 0,
    explanation: params.explanation,
    escalation_status: "none",
    agent_run_id: params.runId,
    risk_prediction_id: params.predictionId,
  });
}

// ============================================
// AGENT TOOL: createEscalation
// ============================================

async function createEscalation(supabase: any, uid: string, runId: string, predictionId: string | null, triggerReason: string) {
  await supabase.from("escalations").insert({
    athlete_id: uid,
    agent_run_id: runId,
    risk_prediction_id: predictionId,
    trigger_reason: triggerReason,
    status: "open",
  });
}

// ============================================
// Main handler — Agentic OBSERVE→THINK→ACT→LOG→REFLECT loop
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

  // Parse request body
  let triggerType = "manual";
  let coachId: string | null = null;
  let singleAthleteId: string | null = null;
  try {
    const body = await req.json();
    if (body?.trigger_type) triggerType = body.trigger_type;
    if (body?.coach_id) coachId = body.coach_id;
    if (body?.athlete_id) singleAthleteId = body.athlete_id;
  } catch { /* no body is fine */ }

  // If no coach_id in body, try to get it from the auth header
  if (!coachId) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const anonSupabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await anonSupabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
        if (profile?.role === "coach") coachId = user.id;
      }
    }
  }

  // Get active model version
  const { data: activeModel } = await supabase
    .from("model_registry").select("version, predictor_type").eq("is_active", true).limit(1).maybeSingle();
  const modelVersion = activeModel?.version || "cloudrun-v1.0";

  // Create agent run
  const { data: agentRun, error: runErr } = await supabase
    .from("agent_runs")
    .insert({ status: "running", trigger_type: triggerType, model_version: modelVersion })
    .select("id").single();

  if (runErr || !agentRun) {
    return new Response(JSON.stringify({ error: "Failed to create agent run", details: runErr }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId = agentRun.id;
  const errors: any[] = [];
  let processed = 0;

  // Fetch athletes — scoped to coach or single athlete, or ALL for scheduled runs
  let athleteQuery = supabase.from("athlete_profiles").select("*");
  if (singleAthleteId) {
    athleteQuery = athleteQuery.eq("user_id", singleAthleteId);
  } else if (coachId) {
    athleteQuery = athleteQuery.eq("coach_id", coachId);
  }
  // For scheduled runs without coach_id or athlete_id, processes ALL athletes
  const { data: athletes } = await athleteQuery;

  for (const athlete of athletes || []) {
    try {
      // ===== 1. OBSERVE =====
      const state = await getAthleteState(supabase, athlete);
      const memory = await getAgentMemory(supabase, state.uid);

      await logAction(supabase, runId, state.uid, "observe", {
        sessions_count: state.sessions.length,
        soreness_logs_count: state.soreLogs.length,
        cycle_day: state.cycleDay,
        phase: state.phaseName,
        autonomy_level: state.autonomyLevel,
        memory: {
          last3Scores: memory.last3Scores,
          predictionTrend: memory.predictionTrend,
          overrideCount7d: memory.overrideCount7d,
          feedbackRatio: memory.feedbackRatio,
        },
      });

      // ===== 2. THINK =====
      let mlResponse: AnalysisResponse;
      try {
        // Enrich payload with memory context
        const enrichedPayload = {
          ...state.athleteInput,
          prediction_trend: memory.predictionTrend,
          coach_override_count_7d: memory.overrideCount7d,
        };
        mlResponse = await callML(mlEndpointUrl, enrichedPayload);
      } catch (mlErr: any) {
        const errMsg = `ML service error for athlete ${state.uid}: ${mlErr.message}`;
        console.error(errMsg);
        errors.push({ athlete_id: state.uid, error: errMsg });
        await logAction(supabase, runId, state.uid, "think", {
          error: errMsg, predictor_type: "ml", status: "failed",
        });
        continue; // Skip — no fallback
      }

      // Map ML response
      const riskProb = mlResponse.risk_profile.acl_risk;
      const riskScore = Math.round(riskProb * 100);
      const riskLevel = mapRiskLevel(mlResponse.composite_risk_level);
      const topDrivers = mlResponse.contributing_factors.map(f => ({
        feature: f.factor, value: f.contribution, contribution: f.contribution, label: f.label,
      }));
      const confidence = mlResponse.confidence;

      await logAction(supabase, runId, state.uid, "think", {
        risk_score: riskScore, risk_level: riskLevel, risk_prob: riskProb,
        predictor_type: "ml", confidence,
        composite_risk_level: mlResponse.composite_risk_level,
        memory_context: {
          prediction_trend: memory.predictionTrend,
          override_count_7d: memory.overrideCount7d,
          feedback_ratio: memory.feedbackRatio,
        },
      });

      // Store prediction
      const { data: prediction } = await supabase
        .from("risk_predictions")
        .insert({
          athlete_id: state.uid, agent_run_id: runId,
          risk_prob: riskProb, risk_score: riskScore, risk_level: riskLevel,
          top_drivers: topDrivers, model_version: modelVersion,
          predictor_type: "ml", confidence,
        })
        .select("id").single();

      // ===== 3. ACT (based on autonomy_level) =====
      const { data: existingPlan } = await supabase
        .from("weekly_plans")
        .select("id, original_plan, locked_by_coach")
        .eq("athlete_id", state.uid)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

      const planLocked = existingPlan?.locked_by_coach === true;
      const basePlan = existingPlan?.original_plan || defaultPlan();
      const { adjusted, changes, planModified } = adjustPlanByAutonomy(
        basePlan as any[], riskScore, state.autonomyLevel, planLocked
      );

      // Build explanation
      const explanationParts: string[] = [];
      if (mlResponse.explanation) explanationParts.push(mlResponse.explanation);
      if (mlResponse.recommended_actions?.length) {
        explanationParts.push(`Recommended: ${mlResponse.recommended_actions.join("; ")}.`);
      }
      if (planLocked) explanationParts.push("(Plan locked by coach — no adjustments made.)");
      else if (state.autonomyLevel === "suggest_only") explanationParts.push("(Suggest-only mode — plan not modified.)");
      else if (state.autonomyLevel === "escalate") explanationParts.push("(Escalate mode — plan not modified, escalation created.)");
      else if (changes.length) explanationParts.push(`Adjustments: ${changes.join("; ")}.`);
      const explanation = explanationParts.join(" ") || `Risk ${riskLevel} (score: ${riskScore}).`;

      // Write risk report
      await writeRiskReport(supabase, {
        uid: state.uid, riskScore, riskLevel, phaseName: state.phaseName,
        acr: state.acr, latestSore: state.latestSore, explanation,
        runId, predictionId: prediction?.id || null,
      });

      // Write/update weekly plan (only modify if auto_adjust and not locked)
      if (state.autonomyLevel === "auto_adjust" && !planLocked) {
        if (existingPlan) {
          await supabase.from("weekly_plans").update({
            adjusted_plan: adjusted, risk_score: riskScore,
            risk_level: riskLevel, explanation, agent_run_id: runId,
          }).eq("id", existingPlan.id);
        } else {
          await supabase.from("weekly_plans").insert({
            athlete_id: state.uid, original_plan: basePlan,
            adjusted_plan: adjusted, risk_score: riskScore,
            risk_level: riskLevel, explanation, agent_run_id: runId,
          });
        }
      } else if (!existingPlan) {
        // No plan exists yet — create one without adjustments
        await supabase.from("weekly_plans").insert({
          athlete_id: state.uid, original_plan: basePlan,
          adjusted_plan: basePlan, risk_score: riskScore,
          risk_level: riskLevel, explanation, agent_run_id: runId,
        });
      }

      // Escalation logic based on autonomy level
      let shouldEscalate = false;
      let triggerReason = "";

      if (state.autonomyLevel === "escalate") {
        // Always escalate regardless of risk level
        shouldEscalate = true;
        triggerReason = `autonomy_level=escalate (score: ${riskScore}, level: ${riskLevel})`;
      } else {
        // Standard escalation rules for auto_adjust and suggest_only
        if (riskLevel === "High") {
          shouldEscalate = true;
          triggerReason = `risk_level=High (score: ${riskScore})`;
        } else if (riskProb > 0.8) {
          shouldEscalate = true;
          triggerReason = `risk_prob=${riskProb.toFixed(2)} > 0.8`;
        }

        // Check 48h score spike
        if (!shouldEscalate && memory.last3Scores.length >= 2) {
          const prevScore = memory.last3Scores[1];
          if (riskScore - prevScore >= 15) {
            shouldEscalate = true;
            triggerReason = `Score jumped +${riskScore - prevScore} since last prediction`;
          }
        }
      }

      if (shouldEscalate) {
        await createEscalation(supabase, state.uid, runId, prediction?.id || null, triggerReason);
      }

      await logAction(supabase, runId, state.uid, "act", {
        autonomy_level: state.autonomyLevel,
        action_taken: state.autonomyLevel,
        plan_modified: planModified,
        plan_locked: planLocked,
        escalated: shouldEscalate,
        trigger_reason: shouldEscalate ? triggerReason : null,
        changes,
      });

      // ===== 4. REFLECT =====
      await logAction(supabase, runId, state.uid, "reflect", {
        prediction_trend: memory.predictionTrend,
        current_score: riskScore,
        last_3_scores: memory.last3Scores,
        override_frequency_7d: memory.overrideCount7d,
        feedback_ratio: memory.feedbackRatio,
        accept_count: memory.acceptCount,
        reject_count: memory.rejectCount,
        confidence,
        injury_forecast: mlResponse.injury_window_forecast,
        trend_analysis: mlResponse.trend_analysis,
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
