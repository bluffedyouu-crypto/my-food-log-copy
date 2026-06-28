import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { foodApi } from "../../api/client";

// ─── Quantity units we let users define for a custom food ─────────────────────
// Each value the user enters is "how many grams equals one of this unit?".
// e.g. piece = 60 → 1 piece weighs 60g. These directly drive the unit dropdown
// in the QuantityModal when this food is later logged. The list must match
// the keys allowed in the Food.quantities sub-schema on the server.
const QUANTITY_UNITS = [
  { key: "piece",      label: "Piece",       placeholder: "g per piece"      },
  { key: "cup",        label: "Cup",         placeholder: "g per cup"        },
  { key: "bowl",       label: "Bowl",        placeholder: "g per bowl"       },
  { key: "glass",      label: "Glass",       placeholder: "g per glass"      },
  { key: "tablespoon", label: "Tablespoon",  placeholder: "g per tbsp"       },
  { key: "teaspoon",   label: "Teaspoon",    placeholder: "g per tsp"        },
  { key: "slice",      label: "Slice",       placeholder: "g per slice"      },
  { key: "plate",      label: "Plate",       placeholder: "g per plate"      },
];

export default function CustomFoodModal({ onClose, onSaved }) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQuantities, setShowQuantities] = useState(false);

  // ── Nutrition state (per 100g) ─────────────────────────────────────────────
  const [formData, setFormData] = useState({
    dish_name: "",
    calories_kcal: "",
    protein_g: "",
    carbohydrates_g: "",
    sugars_g: "",
    dietary_fiber_g: "",
    fat_total_g: "",
  });

  // ── Quantity state — each unit maps to "grams per 1 of this unit". ────────
  // We initialise every key to "" so a controlled input always has a defined
  // value, but only non-empty entries get sent to the server (see buildQuantities).
  const [quantities, setQuantities] = useState(
    QUANTITY_UNITS.reduce((acc, q) => ({ ...acc, [q.key]: "" }), {})
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleQuantityChange = (key, value) => {
    setQuantities((q) => ({ ...q, [key]: value }));
  };

  // ── Build the `quantities` payload the backend will persist. ──────────────
  // Schema rule: `quantities[unit]` stores the *food's per-100g value scaled
  // to the serving's grams*. For the QuantityModal conversion math to work,
  // we want `quantities[unit]` to equal "(100 / grams_per_unit)" — i.e. the
  // ratio that lets `gramsPerUnit = 100 / quantities[unit]` round-trip back
  // to the grams the user typed here. We invert the user input so they only
  // ever have to enter the intuitive "grams per piece/cup/etc" number.
  //
  // Returns null when the user didn't fill in any quantities → keeps the
  // saved doc clean (mongoose will default each sub-field to null).
  const buildQuantities = () => {
    const out = {};
    let any = false;
    for (const { key } of QUANTITY_UNITS) {
      const raw = quantities[key];
      const grams = parseFloat(raw);
      if (Number.isFinite(grams) && grams > 0) {
        out[key] = +(100 / grams).toFixed(4); // see comment above
        any = true;
      }
    }
    return any ? out : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const builtQuantities = buildQuantities();

    // Construct the payload to match the Food schema exactly. Only the
    // whitelisted fields are sent — never spread user input wholesale.
    const newFoodRecord = {
      dish_name: formData.dish_name,
      calories_kcal: parseFloat(formData.calories_kcal) || 0,
      macros: {
        protein_g: parseFloat(formData.protein_g) || 0,
        carbohydrates_g: parseFloat(formData.carbohydrates_g) || 0,
        sugars_g: parseFloat(formData.sugars_g) || 0,
        dietary_fiber_g: parseFloat(formData.dietary_fiber_g) || 0,
        fat_total_g: parseFloat(formData.fat_total_g) || 0,
        water_g: null,
      },
      fats_breakdown: {
        saturated_g: null,
        monounsaturated_g: null,
        polyunsaturated_g: null,
        cholesterol_mg: null,
      },
      vitamins: {
        a_mcg: null, b1_mg: null, b2_mg: null, b3_mg: null, b5_mg: null,
        b6_mg: null, b11_mcg: null, b12_mcg: null, c_mg: null, d_mcg: null,
        e_mg: null, k_mcg: null,
      },
      minerals: {
        sodium_mg: null, calcium_mg: null, iron_mg: null, copper_mg: null,
      },
      ...(builtQuantities ? { quantities: builtQuantities } : {}),
      createdBy: appUser?.email || "unknown_user",
    };

    try {
      const { data } = await foodApi.createCustom(newFoodRecord);
      onSaved(data.food);
    } catch (err) {
      setError(err.message || "Failed to save food.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Add Custom Food</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Can't find it? Add it yourself! Nutrition values should be per 100g.
        </p>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Dish Name *</label>
            <input
              required type="text" name="dish_name"
              value={formData.dish_name} onChange={handleChange}
              style={{ fontSize: "16px" }}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none"
              placeholder="e.g., Mom's Chicken Curry"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Calories (kcal) *</label>
              <input required type="number" step="0.1" name="calories_kcal"
                value={formData.calories_kcal} onChange={handleChange}
                style={{ fontSize: "16px" }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Protein (g) *</label>
              <input required type="number" step="0.1" name="protein_g"
                value={formData.protein_g} onChange={handleChange}
                style={{ fontSize: "16px" }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Carbs (g) *</label>
              <input required type="number" step="0.1" name="carbohydrates_g"
                value={formData.carbohydrates_g} onChange={handleChange}
                style={{ fontSize: "16px" }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Total Fat (g) *</label>
              <input required type="number" step="0.1" name="fat_total_g"
                value={formData.fat_total_g} onChange={handleChange}
                style={{ fontSize: "16px" }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Sugars (g)</label>
              <input type="number" step="0.1" name="sugars_g"
                value={formData.sugars_g} onChange={handleChange}
                style={{ fontSize: "16px" }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Fiber (g)</label>
              <input type="number" step="0.1" name="dietary_fiber_g"
                value={formData.dietary_fiber_g} onChange={handleChange}
                style={{ fontSize: "16px" }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
          </div>

          {/* ── Quantities (optional) ──────────────────────────────────────── */}
          {/*
            Hidden behind a disclosure so the main form stays compact.
            Each row: "How many grams is 1 <unit>?". If filled, that unit
            becomes selectable in the QuantityModal when logging this food.
            Leave them all blank to only allow logging by grams.
          */}
          <div className="pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowQuantities((s) => !s)}
              className="w-full flex items-center justify-between text-left py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">Serving sizes <span className="text-slate-500 font-normal">(optional)</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Define units like "1 piece", "1 cup" so you can log this without weighing it.
                </p>
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform ${showQuantities ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showQuantities && (
              <div className="grid grid-cols-2 gap-3 pb-1">
                {QUANTITY_UNITS.map((u) => (
                  <div key={u.key}>
                    <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                      1 {u.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        inputMode="decimal"
                        value={quantities[u.key]}
                        onChange={(e) => handleQuantityChange(u.key, e.target.value)}
                        placeholder={u.placeholder}
                        style={{ fontSize: "16px" }}
                        className="w-full px-3 py-2.5 pr-8 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">g</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-slate-400 bg-white/5 hover:bg-white/10 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50">
              {loading ? "Saving..." : "Save to Database"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
