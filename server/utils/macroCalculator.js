/**
 * Macro Calculator — Shredd
 * ────────────────────────────────────────────────────────────────────────────
 *  1. BMR        : Mifflin-St Jeor (1990) — the most accurate predictive
 *                  equation for non-athletes per ADA & ESPEN reviews.
 *  2. TDEE       : BMR × activity multiplier (Harris-Benedict factors).
 *  3. Calories   : TDEE ± goal adjustment. If the user gave a target weight
 *                  and a timeframe, we derive the adjustment dynamically from
 *                  the ~7,700 kcal per kg of body-mass rule; otherwise we use
 *                  conservative static offsets. Capped to a safe band so we
 *                  never recommend dangerously aggressive cuts/bulks.
 *  4. Protein    : g/kg of body-weight tiered by activity level AND goal.
 *                  Sedentary / lightly-active users land in the WHO-RDA
 *                  general-population range (1.0–1.5 g/kg). Trainees climb
 *                  into the ISSN 2017 range (1.6–2.2 g/kg). This means a
 *                  ~65 kg moderately-active fat-loss user sees ~98 g protein —
 *                  realistic on an Indian/general diet — rather than the
 *                  athlete-level 130 g the previous version produced.
 *  5. Fat        : AMDR % of total calories (25–30 %) by goal, with two floors:
 *                  (a) 20 % of calories, and (b) 0.5 g/kg of body weight, so
 *                  endogenous hormones and fat-soluble vitamin absorption are
 *                  preserved on aggressive cuts.
 *  6. Carbs      : Whatever calories remain after protein & fat. For a typical
 *                  fat-loss user this naturally lands around 45–55 % of cals —
 *                  the AMDR midpoint, and the only setup compatible with a
 *                  rice/roti/dal-centric Indian diet.
 *  7. Fiber      : 14 g per 1,000 kcal (US Dietary Guidelines), clamped to
 *                  25–40 g/day. ICMR-NIN India recommends 25–40 g, so this
 *                  aligns with both western and Indian standards.
 *
 *  References:
 *    • Mifflin MD et al. Am J Clin Nutr 1990;51(2):241-7.
 *    • Jäger R et al. "ISSN Position Stand: Protein and exercise."
 *      J Int Soc Sports Nutr 2017;14:20.
 *    • Thomas DT et al. "ACSM/AND Position: Nutrition and athletic
 *      performance." Med Sci Sports Exerc 2016;48(3):543-68.
 *    • WHO/FAO/UNU. Protein and amino acid requirements in human nutrition.
 *      WHO Tech Rep Ser 935, 2007 — RDA 0.8 g/kg.
 *    • U.S. Dietary Guidelines for Americans, 2020-2025 (AMDR + fiber).
 *    • ICMR-NIN, Nutrient Requirements for Indians, 2020 — fiber 25–40 g.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── Activity multipliers (Harris-Benedict factors) ─────────────────────────
const ACTIVITY_MULTIPLIERS = {
  sedentary:         1.20,
  lightly_active:    1.375,
  moderately_active: 1.55,
  very_active:       1.725,
  extremely_active:  1.90,
};

// ─── Static fallback calorie offsets ────────────────────────────────────────
// Used when the user didn't supply a `weeksToGoal` timeframe.
const GOAL_ADJUSTMENTS = {
  fat_loss:    -500,   // ~0.5 kg/week loss
  muscle_gain: +300,   // Conservative lean bulk
  recomp:         0,   // Maintenance kcal with high protein
  maintenance:    0,
};

// ─── Protein anchor: tiered by activity level AND goal ──────────────────────
// Values are grams of protein per kg of body weight per day.
// Lower tiers (sedentary, lightly_active) sit near WHO RDA + a small buffer
// — appropriate for general users on a mixed Indian/western diet.
// Higher tiers (very_active, extremely_active) sit in the ISSN 2017 range
// — appropriate for resistance trainees and athletes.
const PROTEIN_PER_KG = {
  sedentary: {
    fat_loss:    1.2,   // RDA 0.8 + 0.4 buffer to protect lean mass in a deficit
    muscle_gain: 1.2,
    recomp:      1.4,
    maintenance: 1.0,
  },
  lightly_active: {
    fat_loss:    1.4,
    muscle_gain: 1.3,
    recomp:      1.5,
    maintenance: 1.1,
  },
  moderately_active: {
    // ── Calibrated against consumer-grade apps for a typical Indian user.
    // 65 kg × 1.5 = ~98 g protein → matches the "realistic" Healthify range
    // while still hitting the lower bound of ISSN's protein-for-fat-loss band.
    fat_loss:    1.5,
    muscle_gain: 1.5,
    recomp:      1.7,
    maintenance: 1.3,
  },
  very_active: {
    fat_loss:    1.8,   // Hits the ISSN-recommended preservation range
    muscle_gain: 1.7,
    recomp:      2.0,
    maintenance: 1.6,
  },
  extremely_active: {
    fat_loss:    2.0,
    muscle_gain: 1.8,
    recomp:      2.2,
    maintenance: 1.8,
  },
};

// ─── Fat anchor: % of total calories, AMDR-aligned ──────────────────────────
const FAT_PCT_OF_CAL = {
  fat_loss:    0.27,   // 27 % — moderate; satiating in a deficit
  muscle_gain: 0.25,   // 25 % — leaves more room for carbs to fuel training
  recomp:      0.27,
  maintenance: 0.30,   // 30 % — AMDR midpoint for general health
};

// ─── Safety bounds ──────────────────────────────────────────────────────────
const MIN_CALORIES    = { female: 1200, male: 1500, other: 1400 };
const MAX_DEFICIT_PCT = 0.25;   // ≤ 25 % below TDEE
const MAX_SURPLUS_PCT = 0.20;   // ≤ 20 % above TDEE
const FAT_FLOOR_PCT   = 0.20;   // ≥ 20 % of total calories from fat
const FAT_FLOOR_GKG   = 0.5;    // ≥ 0.5 g of fat per kg body weight

// ─── Unit helpers ───────────────────────────────────────────────────────────
function lbsToKg(lbs) { return lbs * 0.453592; }
function ftToCm(ft)   { return ft  * 30.48;    }

// ─── BMR: Mifflin-St Jeor ───────────────────────────────────────────────────
function calculateBMR(weightKg, heightCm, age, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "male")   return base + 5;
  if (gender === "female") return base - 161;
  return base - 78; // average for "other" / unspecified
}

// ─── Goal calorie adjustment (with safety caps) ────────────────────────────
function calculateAdjustment({ goal, weightKg, targetWeightKg, weeksToGoal, tdee }) {
  let adjustment = 0;
  let mode       = "static";

  if (goal !== "maintenance" && targetWeightKg && weeksToGoal > 0) {
    const weightDiffKg  = targetWeightKg - weightKg;      // negative for fat loss
    const totalKcalDiff = weightDiffKg * 7700;            // ~7,700 kcal per kg
    adjustment          = totalKcalDiff / (weeksToGoal * 7);
    mode                = "dynamic";
  } else {
    adjustment = GOAL_ADJUSTMENTS[goal] ?? 0;
  }

  // Cap to safe band: never more than ±X % of TDEE.
  const maxDeficit = -(tdee * MAX_DEFICIT_PCT);
  const maxSurplus =   tdee * MAX_SURPLUS_PCT;
  const capped     = Math.max(maxDeficit, Math.min(maxSurplus, adjustment));

  return { adjustment: capped, rawAdjustment: adjustment, mode };
}

// ─── Resolve the protein g/kg for the user's (activity, goal) combo ────────
function resolveProteinPerKg(activityLevel, goal) {
  const tier = PROTEIN_PER_KG[activityLevel] || PROTEIN_PER_KG.sedentary;
  return tier[goal] ?? tier.maintenance;
}

// ─── Macros: protein from BW, fat from % of cal, carbs fill the rest ──────
function calculateMacros({ targetCalories, weightKg, activityLevel, goal }) {
  // 1️⃣  Protein — anchored to body weight, tiered by activity level.
  const proteinPerKg = resolveProteinPerKg(activityLevel, goal);
  const proteinG     = Math.round(proteinPerKg * weightKg);
  const proteinCal   = proteinG * 4;

  // 2️⃣  Fat — AMDR % of calories with two floors (cal %  AND  g/kg).
  const fatPct        = FAT_PCT_OF_CAL[goal] ?? FAT_PCT_OF_CAL.maintenance;
  const fatFromPctCal = targetCalories * fatPct;
  const fatFloorCal1  = targetCalories * FAT_FLOOR_PCT;     // 20 % of cals
  const fatFloorCal2  = FAT_FLOOR_GKG * weightKg * 9;       // 0.5 g/kg of BW
  let   fatCal        = Math.max(fatFromPctCal, fatFloorCal1, fatFloorCal2);
  let   fatG          = Math.round(fatCal / 9);

  // 3️⃣  Carbs — whatever calories remain.
  let carbsCal = targetCalories - proteinCal - fatG * 9;

  // Edge case — extremely high body weight in deep deficit can leave no room
  // for carbs. Trim fat back to its 20 % floor and let carbs settle at 0.
  if (carbsCal < 0) {
    const minFatG = Math.round(fatFloorCal1 / 9);
    fatG          = Math.max(minFatG, fatG + Math.floor(carbsCal / 9));
    carbsCal      = Math.max(0, targetCalories - proteinCal - fatG * 9);
  }

  const carbsG = Math.max(0, Math.round(carbsCal / 4));

  return { proteinG, carbsG, fatsG: fatG, proteinPerKg, fatPct };
}

// ─── Fiber: USDG-style 14 g per 1000 kcal, clamped to ICMR range ──────────
// Floor depends on goal — fat-loss benefits from extra fiber for satiety, so
// we lift the lower bound from 25 g (general) to 30 g for fat-loss users.
function calculateFiber(targetCalories, goal) {
  const raw   = (targetCalories / 1000) * 14;
  const floor = goal === "fat_loss" ? 30 : 25;
  return Math.max(floor, Math.min(40, Math.round(raw)));
}

// ─── Public entry point ────────────────────────────────────────────────────
function calculateDailyTargets(profile) {
  const {
    age, currentWeight, height, gender,
    activityLevel = "sedentary",
    goal          = "maintenance",
    weightUnit, heightUnit,
    targetWeight, weeksToGoal,
  } = profile;

  // ── Normalise to metric ──────────────────────────────────────────────────
  const weightKg       = weightUnit === "lbs" ? lbsToKg(currentWeight) : currentWeight;
  const heightCm       = heightUnit === "ft"  ? ftToCm(height)         : height;
  const targetWeightKg = targetWeight
    ? (weightUnit === "lbs" ? lbsToKg(targetWeight) : targetWeight)
    : null;

  // ── Energy: BMR → TDEE → goal-adjusted calories ──────────────────────────
  const bmr        = calculateBMR(weightKg, heightCm, age, gender || "other");
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary;
  const tdee       = bmr * multiplier;

  const { adjustment, rawAdjustment, mode } = calculateAdjustment({
    goal, weightKg, targetWeightKg, weeksToGoal, tdee,
  });

  const minCals        = MIN_CALORIES[gender] || MIN_CALORIES.other;
  const targetCalories = Math.max(minCals, Math.round(tdee + adjustment));

  // ── Macros ────────────────────────────────────────────────────────────────
  const { proteinG, carbsG, fatsG, proteinPerKg, fatPct } = calculateMacros({
    targetCalories, weightKg, activityLevel, goal,
  });

  // ── Micros ────────────────────────────────────────────────────────────────
  const fiber = calculateFiber(targetCalories, goal);
  const micros = {
    fiber,
    sodium:    2300,
    potassium: 3500,
    vitaminC:  90,
    calcium:   1000,
    iron:      gender === "female" ? 18 : 8,
  };

  return {
    calories: targetCalories,
    protein:  proteinG,
    carbs:    carbsG,
    fats:     fatsG,
    ...micros,
    isManualOverride: false,
    _debug: {
      bmr:            Math.round(bmr),
      tdee:           Math.round(tdee),
      activityMult:   multiplier,
      adjustment:     Math.round(adjustment),
      rawAdjustment:  Math.round(rawAdjustment),
      adjustmentMode: mode,
      weightKgUsed:   Math.round(weightKg * 10) / 10,
      proteinPerKg,
      fatPct,
      pctOfCalories: {
        protein: Math.round((proteinG * 4 / targetCalories) * 100),
        carbs:   Math.round((carbsG   * 4 / targetCalories) * 100),
        fats:    Math.round((fatsG    * 9 / targetCalories) * 100),
      },
    },
  };
}

module.exports = {
  calculateDailyTargets,
  calculateBMR,
  lbsToKg,
  ftToCm,
  PROTEIN_PER_KG,
  FAT_PCT_OF_CAL,
  ACTIVITY_MULTIPLIERS,
  GOAL_ADJUSTMENTS,
};
