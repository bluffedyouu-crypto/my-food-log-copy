/**
 * Macro Calculator
 * Uses Mifflin-St Jeor BMR formula + activity multiplier + goal adjustment
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

const GOAL_ADJUSTMENTS = {
  fat_loss: -500,       // 500 kcal deficit
  muscle_gain: +300,    // 300 kcal surplus
  recomp: 0,            // maintenance calories, high protein
  maintenance: 0,
};

// Macro split ratios [protein%, carbs%, fats%] by goal
const MACRO_SPLITS = {
  fat_loss:     { protein: 0.35, carbs: 0.35, fats: 0.30 },
  muscle_gain:  { protein: 0.30, carbs: 0.45, fats: 0.25 },
  recomp:       { protein: 0.35, carbs: 0.40, fats: 0.25 },
  maintenance:  { protein: 0.25, carbs: 0.50, fats: 0.25 },
};

/**
 * Calculate BMR using Mifflin-St Jeor
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} age
 * @param {string} gender - "male" | "female" | "other"
 */
function calculateBMR(weightKg, heightCm, age, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "male") return base + 5;
  if (gender === "female") return base - 161;
  return base - 78; // average for "other"
}

/**
 * Convert lbs to kg
 */
function lbsToKg(lbs) {
  return lbs * 0.453592;
}

/**
 * Convert ft/in string or decimal feet to cm
 */
function ftToCm(ft) {
  return ft * 30.48;
}

/**
 * Main calculation function
 * @param {Object} profile - User profile data
 * @returns {Object} dailyTargets
 */
function calculateDailyTargets(profile) {
  let { age, currentWeight, height, gender, activityLevel, goal, weightUnit, heightUnit } = profile;

  // Normalize units to metric
  const weightKg = weightUnit === "lbs" ? lbsToKg(currentWeight) : currentWeight;
  const heightCm = heightUnit === "ft" ? ftToCm(height) : height;

  // BMR
  const bmr = calculateBMR(weightKg, heightCm, age, gender || "other");

  // TDEE
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.2;
  const tdee = bmr * multiplier;

  // Goal adjustment
  const adjustment = GOAL_ADJUSTMENTS[goal] || 0;
  const targetCalories = Math.max(1200, Math.round(tdee + adjustment));

  // Macro splits
  const splits = MACRO_SPLITS[goal] || MACRO_SPLITS.maintenance;

  // Calories from each macro
  const proteinCalories = targetCalories * splits.protein;
  const carbCalories = targetCalories * splits.carbs;
  const fatCalories = targetCalories * splits.fats;

  // Convert to grams (protein: 4 kcal/g, carbs: 4 kcal/g, fats: 9 kcal/g)
  const proteinG = Math.round(proteinCalories / 4);
  const carbsG = Math.round(carbCalories / 4);
  const fatsG = Math.round(fatCalories / 9);

  // Micro targets (standard RDA values, adjusted slightly by goal)
  const micros = {
    fiber: goal === "fat_loss" ? 30 : 25,
    sodium: 2300,
    potassium: 3500,
    vitaminC: 90,
    calcium: 1000,
    iron: gender === "female" ? 18 : 8,
  };

  return {
    calories: targetCalories,
    protein: proteinG,
    carbs: carbsG,
    fats: fatsG,
    ...micros,
    isManualOverride: false,
    // Debug info
    _debug: {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      adjustment,
      splits,
    },
  };
}

module.exports = { calculateDailyTargets, calculateBMR, lbsToKg, ftToCm };
