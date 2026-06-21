import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { userApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Button from "../ui/Button";

// ─── Animation Variants ───────────────────────────────────────────────────────
const questionVariants = {
  initial: { opacity: 0, y: 30, filter: "blur(8px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -20,
    filter: "blur(4px)",
    transition: { duration: 0.35, ease: "easeIn" },
  },
};

const optionVariants = {
  initial: { opacity: 0, y: 16 },
  animate: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.2 + i * 0.08, duration: 0.4, ease: "easeOut" },
  }),
};

// ─── Step Definitions ─────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "goal",
    title: "What is your main objective?",
    subtitle: "This shapes your entire nutritional blueprint.",
    type: "choice",
    options: [
      { value: "fat_loss",    label: "Fat Loss",         emoji: "🔥", desc: "Caloric deficit, high protein" },
      { value: "muscle_gain", label: "Lean Muscle Gain", emoji: "💪", desc: "Caloric surplus, balanced macros" },
      { value: "recomp",      label: "Body Recomp",      emoji: "⚡", desc: "Maintain weight, change composition" },
      { value: "maintenance", label: "Maintenance",      emoji: "🎯", desc: "Sustain current physique" },
    ],
  },
  {
    id: "units",
    title: "Your preferred units.",
    subtitle: "We'll use these everywhere — you'll never be asked again.",
    type: "units",
  },
  {
    id: "metrics",
    title: "Tell us about your body.",
    subtitle: "We use this to calculate your precise caloric needs.",
    type: "metrics",
  },
  {
    id: "activityLevel",
    title: "How active is your lifestyle?",
    subtitle: "Be honest — this directly impacts your calorie target.",
    type: "choice",
    options: [
      { value: "sedentary",          label: "Sedentary",          emoji: "🛋️", desc: "Desk job, little to no exercise" },
      { value: "lightly_active",     label: "Lightly Active",     emoji: "🚶", desc: "Light exercise 1–3 days/week" },
      { value: "moderately_active",  label: "Moderately Active",  emoji: "🏋️", desc: "Gym 3–5 days/week" },
      { value: "very_active",        label: "Very Active",        emoji: "🏃", desc: "Hard training 6–7 days/week" },
      { value: "extremely_active",   label: "Extremely Active",   emoji: "🔥", desc: "Very hard exercise, physical job" },
    ],
  },
  {
    id: "mealFrequency",
    title: "How do you prefer to fuel your day?",
    subtitle: "Choose how many meals you want to track daily.",
    type: "frequency",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { updateAppUser } = useAuth();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [answers, setAnswers] = useState({
    goal: "",
    age: "",
    currentWeight: "",
    targetWeight: "",
    height: "",
    gender: "male",
    weightUnit: "kg",
    heightUnit: "cm",
    activityLevel: "",
    mealFrequency: 3,
  });

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canProceed = () => {
    if (currentStep.id === "goal") return !!answers.goal;
    if (currentStep.id === "units") return !!answers.weightUnit && !!answers.heightUnit;
    if (currentStep.id === "metrics") {
      return answers.age && answers.currentWeight && answers.height && answers.gender;
    }
    if (currentStep.id === "activityLevel") return !!answers.activityLevel;
    if (currentStep.id === "mealFrequency") return answers.mealFrequency >= 3;
    return true;
  };

  const next = () => {
    if (!canProceed()) return;
    if (isLast) {
      handleSubmit();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const back = () => {
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await userApi.completeOnboarding(answers);
      updateAppUser(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mb-12">
        {STEPS.map((_, i) => (
          <motion.div
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === step ? "w-8 bg-indigo-500" : i < step ? "w-4 bg-indigo-500/50" : "w-4 bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={questionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2 leading-tight">
                {currentStep.title}
              </h2>
              <p className="text-slate-400 text-base">{currentStep.subtitle}</p>
            </div>

            {/* Step-specific content */}
            {currentStep.type === "choice" && (
              <ChoiceStep
                options={currentStep.options}
                value={answers[currentStep.id]}
                onChange={(v) => setAnswer(currentStep.id, v)}
              />
            )}

            {currentStep.type === "units" && (
              <UnitsStep answers={answers} setAnswer={setAnswer} />
            )}

            {currentStep.type === "metrics" && (
              <MetricsStep answers={answers} setAnswer={setAnswer} />
            )}

            {currentStep.type === "frequency" && (
              <FrequencyStep
                value={answers.mealFrequency}
                onChange={(v) => setAnswer("mealFrequency", v)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm text-center mt-4"
          >
            {error}
          </motion.p>
        )}

        {/* Navigation */}
        <motion.div
          className="flex items-center justify-between mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0}
            className={step === 0 ? "invisible" : ""}
          >
            ← Back
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={next}
            disabled={!canProceed()}
            loading={loading}
            className="min-w-[140px]"
          >
            {isLast ? "Calculate My Plan →" : "Continue →"}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChoiceStep({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {options.map((opt, i) => (
        <motion.button
          key={opt.value}
          custom={i}
          variants={optionVariants}
          initial="initial"
          animate="animate"
          onClick={() => onChange(opt.value)}
          className={`
            flex items-center gap-4 p-4 rounded-2xl border text-left
            transition-all duration-200 cursor-pointer
            ${value === opt.value
              ? "border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/20"
              : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
            }
          `}
        >
          <span className="text-2xl">{opt.emoji}</span>
          <div className="flex-1">
            <p className={`font-semibold ${value === opt.value ? "text-indigo-300" : "text-white"}`}>
              {opt.label}
            </p>
            <p className="text-sm text-slate-400">{opt.desc}</p>
          </div>
          {value === opt.value && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0"
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </motion.div>
          )}
        </motion.button>
      ))}
    </div>
  );
}

function UnitsStep({ answers, setAnswer }) {
  return (
    <div className="space-y-6">
      {/* Weight unit */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">Preferred Weight Unit</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "kg",  label: "Kilograms", sub: "kg", emoji: "🌍" },
            { value: "lbs", label: "Pounds",    sub: "lbs", emoji: "🇺🇸" },
          ].map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => setAnswer("weightUnit", opt.value)}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                answers.weightUnit === opt.value
                  ? "border-indigo-500 bg-indigo-500/15"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <div>
                <p className={`font-semibold ${answers.weightUnit === opt.value ? "text-indigo-300" : "text-white"}`}>
                  {opt.label}
                </p>
                <p className="text-sm text-slate-500">{opt.sub}</p>
              </div>
              {answers.weightUnit === opt.value && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="ml-auto w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Height unit */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">Preferred Height Unit</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "cm", label: "Centimetres", sub: "cm",   emoji: "📏" },
            { value: "ft", label: "Feet / Inches", sub: "ft/in", emoji: "📐" },
          ].map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => setAnswer("heightUnit", opt.value)}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                answers.heightUnit === opt.value
                  ? "border-indigo-500 bg-indigo-500/15"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <div>
                <p className={`font-semibold ${answers.heightUnit === opt.value ? "text-indigo-300" : "text-white"}`}>
                  {opt.label}
                </p>
                <p className="text-sm text-slate-500">{opt.sub}</p>
              </div>
              {answers.heightUnit === opt.value && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="ml-auto w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricsStep({ answers, setAnswer }) {
  const wUnit = answers.weightUnit || "kg";
  const hUnit = answers.heightUnit || "cm";

  return (
    <div className="space-y-4">
      {/* Gender */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-2 block">Gender</label>
        <div className="flex gap-3">
          {["male", "female", "other"].map((g) => (
            <button
              key={g}
              onClick={() => setAnswer("gender", g)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${
                answers.gender === g
                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                  : "border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Age + Height */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1.5 block">Age</label>
          <input
            type="number"
            placeholder="25"
            value={answers.age}
            onChange={(e) => setAnswer("age", e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-1.5 block">
            Height <span className="text-slate-500 font-normal">({hUnit})</span>
          </label>
          <input
            type="number"
            placeholder={hUnit === "cm" ? "175" : "5.9"}
            value={answers.height}
            onChange={(e) => setAnswer("height", e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>

      {/* Current + Target Weight */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1.5 block">
            Current Weight <span className="text-slate-500 font-normal">({wUnit})</span>
          </label>
          <input
            type="number"
            placeholder={wUnit === "kg" ? "75" : "165"}
            value={answers.currentWeight}
            onChange={(e) => setAnswer("currentWeight", e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-1.5 block">
            Target Weight <span className="text-slate-500 font-normal">({wUnit})</span>
          </label>
          <input
            type="number"
            placeholder={wUnit === "kg" ? "70" : "155"}
            value={answers.targetWeight}
            onChange={(e) => setAnswer("targetWeight", e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>
    </div>
  );
}

function FrequencyStep({ value, onChange }) {
  const options = [3, 4, 5, 6];
  const mealNames = {
    3: ["Breakfast", "Lunch", "Dinner"],
    4: ["Early Fuel", "Breakfast", "Lunch", "Dinner"],
    5: ["Early Fuel", "Breakfast", "Morning Snack", "Lunch", "Dinner"],
    6: ["Early Fuel", "Breakfast", "Morning Snack", "Lunch", "Afternoon Graze", "Dinner"],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {options.map((n, i) => (
          <motion.button
            key={n}
            custom={i}
            variants={optionVariants}
            initial="initial"
            animate="animate"
            onClick={() => onChange(n)}
            className={`
              py-4 rounded-2xl border text-center transition-all duration-200
              ${value === n
                ? "border-indigo-500 bg-indigo-500/15"
                : "border-white/10 hover:border-white/20 hover:bg-white/5"
              }
            `}
          >
            <div className={`text-2xl font-bold ${value === n ? "text-indigo-300" : "text-white"}`}>{n}</div>
            <div className="text-xs text-slate-400 mt-1">meals</div>
          </motion.button>
        ))}
      </div>

      {/* Preview meal names */}
      <motion.div
        key={value}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/3 border border-white/10 rounded-2xl p-4"
      >
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Your meal schedule</p>
        <div className="space-y-2">
          {(mealNames[value] || []).map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="text-sm text-slate-300">{name}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
