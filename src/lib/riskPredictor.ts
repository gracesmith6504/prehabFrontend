// Model-agnostic Risk Predictor Interface + Implementations

import {
  type MenstrualPhase,
  PHASE_MULTIPLIERS,
  calculateAcuteChronicRatio,
  calculateSorenessContribution,
  calculateRiskScore,
  getCurrentPhase,
} from './riskEngine';

export interface RiskDriver {
  feature: string;
  value: number | string;
  contribution: number; // 0-1
}

export interface RiskPrediction {
  risk_prob: number;       // 0-1
  risk_score: number;      // 0-100
  risk_level: 'Low' | 'Medium' | 'High';
  top_drivers: RiskDriver[];
  model_version: string;
  trained_at: string | null;
  predictor_type: 'ml' | 'rules';
  confidence: number;      // 0-1
}

export interface AthleteData {
  phase: MenstrualPhase;
  acuteChronicRatio: number;
  sorenessContribution: number;
  phaseMultiplier: number;
}

export interface RiskPredictor {
  predict(data: AthleteData): Promise<RiskPrediction>;
}

// ============================================
// Rules-Based Predictor (wraps existing riskEngine)
// ============================================
export class RulesBasedPredictor implements RiskPredictor {
  async predict(data: AthleteData): Promise<RiskPrediction> {
    const { score, level } = calculateRiskScore(data.phase, data.acuteChronicRatio, data.sorenessContribution);

    // Calculate driver contributions (normalized to sum ≈ 1)
    const phaseContrib = (data.phaseMultiplier - 1.0) / 0.4; // 0 to 1
    const loadContrib = Math.min(data.acuteChronicRatio / 2.0, 1);
    const sorenessContrib = data.sorenessContribution / 100;
    const total = phaseContrib + loadContrib + sorenessContrib || 1;

    const top_drivers: RiskDriver[] = [
      { feature: 'Acute:Chronic Ratio', value: data.acuteChronicRatio, contribution: loadContrib / total },
      { feature: 'Menstrual Phase', value: data.phase, contribution: phaseContrib / total },
      { feature: 'Soreness', value: data.sorenessContribution, contribution: sorenessContrib / total },
    ].sort((a, b) => b.contribution - a.contribution);

    return {
      risk_prob: score / 100,
      risk_score: score,
      risk_level: level as 'Low' | 'Medium' | 'High',
      top_drivers,
      model_version: 'rules-v1.0',
      trained_at: null,
      predictor_type: 'rules',
      confidence: 1.0,
    };
  }
}

// ============================================
// ML Predictor Stub (calls external endpoint)
// ============================================
export class MLPredictor implements RiskPredictor {
  private endpoint: string;
  private fallback: RulesBasedPredictor;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.fallback = new RulesBasedPredictor();
  }

  async predict(data: AthleteData): Promise<RiskPrediction> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: data.phase,
          acute_chronic_ratio: data.acuteChronicRatio,
          soreness_contribution: data.sorenessContribution,
          phase_multiplier: data.phaseMultiplier,
        }),
      });

      if (!response.ok) {
        console.warn('ML endpoint returned non-OK, falling back to rules');
        return this.fallback.predict(data);
      }

      const prediction: RiskPrediction = await response.json();

      // Fall back if confidence is too low
      if (prediction.confidence < 0.5) {
        console.warn('ML confidence too low, falling back to rules');
        return this.fallback.predict(data);
      }

      return { ...prediction, predictor_type: 'ml' };
    } catch (err) {
      console.error('ML predictor failed, using rules fallback:', err);
      return this.fallback.predict(data);
    }
  }
}

// ============================================
// Factory: creates the best available predictor
// ============================================
export function createPredictor(mlEndpoint?: string): RiskPredictor {
  if (mlEndpoint) {
    return new MLPredictor(mlEndpoint);
  }
  return new RulesBasedPredictor();
}
