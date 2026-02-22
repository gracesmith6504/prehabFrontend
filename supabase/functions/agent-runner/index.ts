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
// Lovable AI (Gemini) — coach-friendly explanations
// ============================================

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[GEMINI] LOVABLE_API_KEY not set — skipping AI explanation");
    return "";
  }

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert sports physiotherapist and performance coach AI assistant for the PREHAB injury prevention platform. Write brief, actionable explanations (2-4 sentences max) for coaches and athletes. Use plain language, no jargon. Be direct about what the data means and what to do about it. Never use markdown formatting.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!resp.ok) {
      const status = resp.status;
      if (status === 429 || status === 402) {
        console.warn(`[GEMINI] Rate limited (${status}) — falling back to template`);
        return "";
      }
      console.warn(`[GEMINI] Error ${status} — falling back to template`);
      return "";
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    console.warn(`[GEMINI] Failed: ${err.message} — falling back to template`);
    return "";
  }
}

// ============================================
// Agent-native usage economics — Paid.ai signal recording
// Measures autonomous work performed, compute consumed,
// and economic value created (cost vs. time saved).
// ============================================

const PAID_AGENT_ID = "prehab-agent";

interface EconomicsData {
  compute_cost_eur?: number;
  ml_calls?: number;
  plan_adjusted?: boolean;
  escalated?: boolean;
  hours_saved_estimate?: number;
  manual_value_eur_estimate?: number;
  [key: string]: any;
}

async function recordPaidSignal(
  eventName: string,
  athleteId: string,
  economics: EconomicsData = {},
) {
  const apiKey = Deno.env.get("PAID_API_KEY");
  if (!apiKey) {
    console.log(`[Paid.ai] PAID_API_KEY not set — skipping: ${eventName}`);
    return;
  }

  const orderId = `order_${athleteId}_${new Date().toISOString().slice(0, 7).replace("-", "")}`;

  try {
    const resp = await fetch("https://api.agentpaid.io/api/v1/usage/v2/signals/bulk", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signals: [{
          event_name: eventName,
          agent_id: PAID_AGENT_ID,
          external_customer_id: athleteId,
          external_product_id: orderId,
          data: economics,
        }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[Paid.ai] Signal failed [${resp.status}]: ${body}`);
    } else {
      await resp.text();
      console.log(`[Paid.ai] Agent work tracked: ${eventName} | athlete=${athleteId} | compute=€${economics.compute_cost_eur ?? 0}`);
    }
  } catch (err: any) {
    console.warn(`[Paid.ai] Failed to record signal: ${err.message}`);
  }
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
// AGENT TOOL: getAdaptiveState (closed-loop)
// ============================================

async function getAdaptiveState(supabase: any, athleteId: string) {
  const { data } = await supabase
    .from("athlete_agent_state")
    .select("*")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  return data;
}

// ============================================
// AGENT TOOL: evaluateAdaptivePolicy (REFLECT)
// ============================================

async function evaluateAdaptivePolicy(
  supabase: any, runId: string, athleteId: string,
  memory: { rejectCount: number; acceptCount: number }
) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

  // Count rejected/reverted feedback in last 7 days
  const { data: recentFeedback } = await supabase
    .from("feedback_events")
    .select("feedback_type")
    .eq("athlete_id", athleteId)
    .gte("created_at", sevenDaysAgo)
    .in("feedback_type", ["rejected", "modified"]);
  const rejectCount7d = (recentFeedback || []).length;

  // Count escalations resolved as false alarm in last 14 days
  const { data: resolvedEscalations } = await supabase
    .from("escalations")
    .select("id, notes")
    .eq("athlete_id", athleteId)
    .eq("status", "resolved")
    .gte("created_at", fourteenDaysAgo);
  // Heuristic: resolved quickly (within 1h) or notes contain "false" = false alarm
  const falseAlarmCount = (resolvedEscalations || []).filter((e: any) =>
    e.notes?.toLowerCase().includes("false alarm") ||
    e.notes?.toLowerCase().includes("not needed") ||
    e.notes?.toLowerCase().includes("unnecessary")
  ).length;

  const updates: any = { updated_at: now.toISOString(), reasons: [] as any[] };
  let policyChanged = false;

  // Rule 1: ≥3 rejections → downgrade to suggest_only for 7 days
  if (rejectCount7d >= 3) {
    updates.autonomy_override = "suggest_only";
    updates.autonomy_override_until = new Date(now.getTime() + 7 * 86400000).toISOString();
    updates.adjustment_intensity_multiplier = 0.5;
    updates.policy_mode = "dampened";
    (updates.reasons as any[]).push({
      rule: "reject_threshold",
      detail: `${rejectCount7d} rejections in 7d → suggest_only for 7 days, intensity halved`,
      applied_at: now.toISOString(),
    });
    policyChanged = true;
  }

  // Rule 2: ≥2 false alarm escalations → raise threshold for 14 days
  if (falseAlarmCount >= 2) {
    updates.escalation_threshold_override = "high_only";
    updates.escalation_threshold_override_until = new Date(now.getTime() + 14 * 86400000).toISOString();
    (updates.reasons as any[]).push({
      rule: "false_alarm_threshold",
      detail: `${falseAlarmCount} false alarm escalations in 14d → escalation threshold raised for 14 days`,
      applied_at: now.toISOString(),
    });
    policyChanged = true;
  }

  if (policyChanged) {
    // Upsert the adaptive state
    const { data: existing } = await supabase
      .from("athlete_agent_state")
      .select("id")
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (existing) {
      await supabase.from("athlete_agent_state").update(updates).eq("athlete_id", athleteId);
    } else {
      await supabase.from("athlete_agent_state").insert({ athlete_id: athleteId, ...updates });
    }

    await logAction(supabase, runId, athleteId, "policy_update", {
      rejectCount7d, falseAlarmCount,
      autonomy_override: updates.autonomy_override || null,
      escalation_threshold_override: updates.escalation_threshold_override || null,
      adjustment_intensity_multiplier: updates.adjustment_intensity_multiplier,
      reasons: updates.reasons,
    });
  }

  return { policyChanged, rejectCount7d, falseAlarmCount };
}

// ============================================
// AGENT TOOL: applyAdaptiveOverrides
// ============================================

function applyAdaptiveOverrides(
  autonomyLevel: string,
  adaptiveState: any | null
): { effectiveAutonomy: string; intensityMultiplier: number; escalationThreshold: string } {
  let effectiveAutonomy = autonomyLevel;
  let intensityMultiplier = 1.0;
  let escalationThreshold = "standard"; // standard = existing logic

  if (!adaptiveState) return { effectiveAutonomy, intensityMultiplier, escalationThreshold };

  const now = new Date();

  // Apply autonomy override if still active
  if (adaptiveState.autonomy_override && adaptiveState.autonomy_override_until) {
    if (new Date(adaptiveState.autonomy_override_until) > now) {
      effectiveAutonomy = adaptiveState.autonomy_override;
      intensityMultiplier = Number(adaptiveState.adjustment_intensity_multiplier) || 0.5;
    }
  }

  // Apply escalation threshold override if still active
  if (adaptiveState.escalation_threshold_override && adaptiveState.escalation_threshold_override_until) {
    if (new Date(adaptiveState.escalation_threshold_override_until) > now) {
      escalationThreshold = adaptiveState.escalation_threshold_override;
    }
  }

  return { effectiveAutonomy, intensityMultiplier, escalationThreshold };
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

function adjustPlanByAutonomy(original: any[], riskScore: number, autonomyLevel: string, planLocked: boolean, intensityMultiplier: number = 1.0) {
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

  // Track escalation — autonomous agent work
  await recordPaidSignal("escalation_created", uid, {
    compute_cost_eur: 0.01,
    ml_calls: 0,
    plan_adjusted: false,
    escalated: true,
    hours_saved_estimate: 0.5,
    manual_value_eur_estimate: 20,
    trigger_reason: triggerReason,
  });
}

// ============================================
// AGENT TOOL: Goal tracking (REFLECT)
// ============================================

async function getActiveGoals(supabase: any, athleteId: string) {
  const { data } = await supabase
    .from("athlete_goals")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("status", "active");
  return data || [];
}

function computeGoalMetric(metricType: string, state: { acr: number }, riskScore: number, sessions: any[]): number {
  switch (metricType) {
    case "risk_score": return riskScore;
    case "acr": return state.acr;
    case "weekly_load": {
      const now = Date.now();
      let total = 0;
      for (const s of sessions) {
        if (new Date(s.date).getTime() >= now - 7 * 86400000) {
          const m = s.intensity === "High" ? 1.5 : s.intensity === "Medium" ? 1.0 : 0.6;
          total += (s.duration * s.rpe * m) / 10;
        }
      }
      return total;
    }
    default: return 0;
  }
}

function computeGoalProgress(goal: any, currentValue: number): { progressPct: number; achieved: boolean; failed: boolean } {
  const now = new Date();
  const deadline = new Date(goal.deadline);
  const failed = now > deadline;

  if (goal.direction === "maintain_range") {
    const inRange = currentValue >= (goal.target_range_min ?? 0) && currentValue <= (goal.target_range_max ?? 100);
    return { progressPct: inRange ? 100 : 0, achieved: inRange && !failed, failed: failed && !inRange };
  }

  const baseline = Number(goal.baseline_value);
  const target = Number(goal.target_value);
  const diff = baseline - target; // for decrease
  if (diff === 0) return { progressPct: 100, achieved: true, failed: false };

  if (goal.direction === "decrease") {
    const progress = Math.min(100, Math.max(0, ((baseline - currentValue) / diff) * 100));
    return { progressPct: Math.round(progress), achieved: currentValue <= target, failed: failed && currentValue > target };
  } else {
    // increase
    const diff2 = target - baseline;
    if (diff2 === 0) return { progressPct: 100, achieved: true, failed: false };
    const progress = Math.min(100, Math.max(0, ((currentValue - baseline) / diff2) * 100));
    return { progressPct: Math.round(progress), achieved: currentValue >= target, failed: failed && currentValue < target };
  }
}

async function evaluateGoals(
  supabase: any, runId: string, athleteId: string,
  riskScore: number, state: any
) {
  const goals = await getActiveGoals(supabase, athleteId);
  const goalResults: any[] = [];

  for (const goal of goals) {
    const currentValue = computeGoalMetric(goal.metric_type, state, riskScore, state.sessions);
    const { progressPct, achieved, failed } = computeGoalProgress(goal, currentValue);

    // Update progress history
    const history = Array.isArray(goal.progress_history) ? [...goal.progress_history] : [];
    history.push({ date: new Date().toISOString().split("T")[0], value: currentValue, progress_pct: progressPct });
    // Keep last 30 entries
    if (history.length > 30) history.splice(0, history.length - 30);

    const updates: any = {
      current_value: currentValue,
      progress_pct: progressPct,
      progress_history: history,
    };
    if (achieved) { updates.status = "achieved"; updates.achieved_at = new Date().toISOString(); }
    if (failed) { updates.status = "failed"; }

    await supabase.from("athlete_goals").update(updates).eq("id", goal.id);

    goalResults.push({
      id: goal.id, metric_type: goal.metric_type, direction: goal.direction,
      target: goal.target_value, baseline: goal.baseline_value,
      current: currentValue, progress_pct: progressPct, achieved, failed,
    });
  }

  // Auto-create goals if none exist and we have enough data
  if (goals.length === 0 && state.sessions.length >= 7) {
    const newGoals: any[] = [];

    // Risk reduction goal if score > 40
    if (riskScore > 40) {
      const targetScore = Math.round(riskScore * 0.9); // 10% reduction
      const goalReason = await callGemini(
        `Write a 1-sentence reason for setting this athlete's goal: reduce injury risk score from ${riskScore} to ${targetScore} over 4 weeks. Their current phase is ${state.phaseName}, ACR is ${state.acr.toFixed(2)}, and trend is ${state.sessions.length} sessions logged. Be specific and motivating.`
      );
      newGoals.push({
        athlete_id: athleteId, created_by: athleteId, created_by_type: "agent",
        metric_type: "risk_score", direction: "decrease",
        target_value: targetScore, baseline_value: riskScore,
        current_value: riskScore,
        deadline: new Date(Date.now() + 28 * 86400000).toISOString(),
        agent_run_id: runId,
        reason: goalReason || `Auto-generated: Reduce risk score from ${riskScore} to ${targetScore} (10% reduction over 4 weeks)`,
      });
    }

    // ACR maintenance goal if ACR is available
    if (state.acr > 0) {
      const acrReason = await callGemini(
        `Write a 1-sentence reason for this athlete's goal: maintain acute:chronic workload ratio between 0.8 and 1.3. Current ACR is ${state.acr.toFixed(2)}. Explain why this range matters for injury prevention in plain language.`
      );
      newGoals.push({
        athlete_id: athleteId, created_by: athleteId, created_by_type: "agent",
        metric_type: "acr", direction: "maintain_range",
        target_value: 1.0, target_range_min: 0.8, target_range_max: 1.3,
        baseline_value: state.acr, current_value: state.acr,
        deadline: new Date(Date.now() + 28 * 86400000).toISOString(),
        agent_run_id: runId,
        reason: acrReason || "Auto-generated: Maintain acute:chronic workload ratio in safe zone (0.8–1.3)",
      });
    }

    if (newGoals.length > 0) {
      await supabase.from("athlete_goals").insert(newGoals);
      await logAction(supabase, runId, athleteId, "goal_created", {
        goals_created: newGoals.length,
        details: newGoals.map(g => ({ metric: g.metric_type, target: g.target_value, direction: g.direction, reason: g.reason })),
      });
    }
  }

  return goalResults;
}

// Goal-aware plan influence: if goals exist, bias adjustments toward goal achievement
function getGoalInfluence(goalResults: any[]): { shouldReduceLoad: boolean; shouldIncreaseRecovery: boolean; goalContext: string[] } {
  const context: string[] = [];
  let shouldReduceLoad = false;
  let shouldIncreaseRecovery = false;

  for (const g of goalResults) {
    if (g.metric_type === "risk_score" && g.direction === "decrease" && g.progress_pct < 50) {
      shouldReduceLoad = true;
      shouldIncreaseRecovery = true;
      context.push(`Risk reduction goal at ${g.progress_pct}% — biasing toward lower intensity.`);
    }
    if (g.metric_type === "acr" && g.current > 1.3) {
      shouldReduceLoad = true;
      context.push(`ACR goal: current ${g.current.toFixed(2)} exceeds safe range — reducing load.`);
    }
  }

  return { shouldReduceLoad, shouldIncreaseRecovery, goalContext: context };
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

      // ===== 3. ACT (with adaptive policy overrides) =====
      const adaptiveState = await getAdaptiveState(supabase, state.uid);
      const { effectiveAutonomy, intensityMultiplier, escalationThreshold } =
        applyAdaptiveOverrides(state.autonomyLevel, adaptiveState);

      // Log applied overrides if active
      if (effectiveAutonomy !== state.autonomyLevel || escalationThreshold !== "standard") {
        await logAction(supabase, runId, state.uid, "policy_applied", {
          original_autonomy: state.autonomyLevel,
          effective_autonomy: effectiveAutonomy,
          intensity_multiplier: intensityMultiplier,
          escalation_threshold: escalationThreshold,
          adaptive_state_id: adaptiveState?.id || null,
          autonomy_override_until: adaptiveState?.autonomy_override_until || null,
          escalation_override_until: adaptiveState?.escalation_threshold_override_until || null,
        });
      }

      const { data: existingPlan } = await supabase
        .from("weekly_plans")
        .select("id, original_plan, locked_by_coach")
        .eq("athlete_id", state.uid)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

      const planLocked = existingPlan?.locked_by_coach === true;
      const basePlan = existingPlan?.original_plan || defaultPlan();
      let { adjusted, changes, planModified } = adjustPlanByAutonomy(
        basePlan as any[], riskScore, effectiveAutonomy, planLocked, intensityMultiplier
      );

      // Evaluate goals and apply goal-aware influence
      const goalResults = await evaluateGoals(supabase, runId, state.uid, riskScore, state);
      const goalInfluence = getGoalInfluence(goalResults);

      // Apply goal-driven plan adjustments (only if auto_adjust and not locked)
      if (effectiveAutonomy === "auto_adjust" && !planLocked && (goalInfluence.shouldReduceLoad || goalInfluence.shouldIncreaseRecovery)) {
        adjusted.forEach((s: any) => {
          if (goalInfluence.shouldReduceLoad && s.intensity === "High" && s.type !== "Match") {
            if (!changes.some(c => c.includes(s.day))) {
              changes.push(`Goal-driven: Reduced ${s.type} intensity (${s.day}) to Medium`);
              s.intensity = "Medium";
              s.notes = (s.notes ? s.notes + " | " : "") + "Intensity lowered to pursue goal";
              planModified = true;
            }
          }
        });
      }

      // Build explanation — use Gemini for coach-friendly narrative
      const templateParts: string[] = [];
      if (planLocked) templateParts.push("Plan locked by coach — no adjustments made.");
      else if (effectiveAutonomy === "suggest_only" && effectiveAutonomy !== state.autonomyLevel) {
        templateParts.push("Adaptive policy: downgraded to suggest_only due to repeated coach rejections.");
      } else if (effectiveAutonomy === "suggest_only") templateParts.push("Suggest-only mode — plan not modified.");
      else if (effectiveAutonomy === "escalate") templateParts.push("Escalate mode — plan not modified, escalation created.");
      else if (changes.length) templateParts.push(`Adjustments: ${changes.join("; ")}.`);
      if (intensityMultiplier < 1.0 && planModified) {
        templateParts.push(`Adjustment intensity reduced to ${Math.round(intensityMultiplier * 100)}% by adaptive policy.`);
      }
      if (goalInfluence.goalContext.length) {
        templateParts.push(`Goals: ${goalInfluence.goalContext.join(" ")}`);
      }
      const templateExplanation = templateParts.join(" ");

      // Generate Gemini-powered explanation (athlete-facing, empathetic tone)
      const geminiPrompt = `You are writing a short personal message (2-3 sentences) directly to a female athlete about her current injury risk. Use "you/your" language. Be warm, supportive, and specific about what's happening and what's being done to help. Do NOT repeat raw numbers or technical terms like "acute:chronic ratio". Instead, translate the data into plain, encouraging language.

Data (do not expose these numbers directly):
- Risk score: ${riskScore}/100 (${riskLevel})
- Cycle phase: ${state.phaseName}
- Training load ratio: ${state.acr.toFixed(2)}
- Trend: ${memory.predictionTrend} (recent scores: ${memory.last3Scores.join(", ")})
- Key factors: ${topDrivers.slice(0, 3).map((d: any) => d.label || d.feature).join(", ")}
- Plan adjustments made: ${changes.length ? changes.join("; ") : "none"}
- Active goals: ${goalResults.map((g: any) => `${g.metric_type} ${g.direction} → ${g.progress_pct}% progress`).join("; ") || "none"}

Write the message now:`;

      const geminiExplanation = await callGemini(geminiPrompt);
      const explanation = geminiExplanation || templateExplanation || `Risk ${riskLevel} (score: ${riskScore}).`;

      // Write risk report
      await writeRiskReport(supabase, {
        uid: state.uid, riskScore, riskLevel, phaseName: state.phaseName,
        acr: state.acr, latestSore: state.latestSore, explanation,
        runId, predictionId: prediction?.id || null,
      });

      // Write/update weekly plan (only modify if auto_adjust and not locked)
      if (effectiveAutonomy === "auto_adjust" && !planLocked) {
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
        await supabase.from("weekly_plans").insert({
          athlete_id: state.uid, original_plan: basePlan,
          adjusted_plan: basePlan, risk_score: riskScore,
          risk_level: riskLevel, explanation, agent_run_id: runId,
        });
      }

      // Escalation logic with adaptive threshold
      let shouldEscalate = false;
      let triggerReason = "";

      if (effectiveAutonomy === "escalate") {
        shouldEscalate = true;
        triggerReason = `autonomy_level=escalate (score: ${riskScore}, level: ${riskLevel})`;
      } else {
        // Apply escalation threshold: "high_only" means only escalate for High risk
        const thresholdScore = escalationThreshold === "high_only" ? 80 : 0;

        if (riskLevel === "High" && riskScore > thresholdScore) {
          shouldEscalate = true;
          triggerReason = `risk_level=High (score: ${riskScore})`;
        } else if (riskProb > 0.8 && escalationThreshold !== "high_only") {
          shouldEscalate = true;
          triggerReason = `risk_prob=${riskProb.toFixed(2)} > 0.8`;
        }

        // Check 48h score spike (skip if threshold raised)
        if (!shouldEscalate && escalationThreshold !== "high_only" && memory.last3Scores.length >= 2) {
          const prevScore = memory.last3Scores[1];
          if (riskScore - prevScore >= 15) {
            shouldEscalate = true;
            triggerReason = `Score jumped +${riskScore - prevScore} since last prediction`;
          }
        }

        if (!shouldEscalate && escalationThreshold === "high_only") {
          console.log(`[ACT] Escalation suppressed for ${state.uid} — adaptive threshold=high_only`);
        }
      }

      if (shouldEscalate) {
        await createEscalation(supabase, state.uid, runId, prediction?.id || null, triggerReason);
      }

      await logAction(supabase, runId, state.uid, "act", {
        autonomy_level: state.autonomyLevel,
        effective_autonomy: effectiveAutonomy,
        intensity_multiplier: intensityMultiplier,
        escalation_threshold: escalationThreshold,
        action_taken: effectiveAutonomy,
        plan_modified: planModified,
        plan_locked: planLocked,
        escalated: shouldEscalate,
        trigger_reason: shouldEscalate ? triggerReason : null,
        changes,
        goals: {
          active_goals: goalResults.length,
          goal_influence: goalInfluence.goalContext,
          results: goalResults,
        },
      });

      // ===== Agent-native usage economics =====
      // 1. Core agent run signal — every evaluation is autonomous work
      await recordPaidSignal("agent_run", state.uid, {
        compute_cost_eur: 0.03,
        ml_calls: 1,
        plan_adjusted: planModified,
        escalated: shouldEscalate,
        hours_saved_estimate: 0.5,
        manual_value_eur_estimate: 20,
        risk_level: riskLevel,
        risk_score: riskScore,
      });

      // 2. Risk evaluation signal — ML model invocation
      await recordPaidSignal("risk_evaluation", state.uid, {
        compute_cost_eur: 0.02,
        ml_calls: 1,
        plan_adjusted: false,
        escalated: false,
        hours_saved_estimate: 0.25,
        manual_value_eur_estimate: 10,
        risk_level: riskLevel,
        confidence,
      });

      // 3. Plan-adjustment surcharge — proves autonomous preventative work
      if (planModified) {
        await recordPaidSignal("plan_adjustment", state.uid, {
          compute_cost_eur: 0.05,
          ml_calls: 0,
          plan_adjusted: true,
          escalated: false,
          hours_saved_estimate: 0.75,
          manual_value_eur_estimate: 30,
          changes,
          autonomy_level: effectiveAutonomy,
        });
      }

      // ===== 4. REFLECT (closed-loop policy evaluation) =====
      const policyResult = await evaluateAdaptivePolicy(supabase, runId, state.uid, memory);

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
        adaptive_policy: {
          policy_changed: policyResult.policyChanged,
          reject_count_7d: policyResult.rejectCount7d,
          false_alarm_count_14d: policyResult.falseAlarmCount,
        },
        goals: {
          evaluated: goalResults.length,
          achieved: goalResults.filter(g => g.achieved).length,
          failed: goalResults.filter(g => g.failed).length,
          in_progress: goalResults.filter(g => !g.achieved && !g.failed).length,
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
