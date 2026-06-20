import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { foodApi } from "../../api/client"; // FIXED: Now importing foodApi instead of userApi

export default function CustomFoodModal({ onClose, onSaved }) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State (focusing on the essentials first)
  const [formData, setFormData] = useState({
    dish_name: "",
    calories_kcal: "",
    protein_g: "",
    carbohydrates_g: "",
    sugars_g: "",
    dietary_fiber_g: "",
    fat_total_g: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Construct the payload to perfectly match your MongoDB schema
    const newFoodRecord = {
      dish_name: formData.dish_name,
      calories_kcal: parseFloat(formData.calories_kcal) || 0,
      macros: {
        protein_g: parseFloat(formData.protein_g) || 0,
        carbohydrates_g: parseFloat(formData.carbohydrates_g) || 0,
        sugars_g: parseFloat(formData.sugars_g) || 0,
        dietary_fiber_g: parseFloat(formData.dietary_fiber_g) || 0,
        fat_total_g: parseFloat(formData.fat_total_g) || 0,
        water_g: null
      },
      fats_breakdown: {
        saturated_g: null, monounsaturated_g: null, polyunsaturated_g: null, cholesterol_mg: null
      },
      vitamins: {
        a_mcg: null, b1_mg: null, b2_mg: null, b3_mg: null, b5_mg: null, b6_mg: null, 
        b11_mcg: null, b12_mcg: null, c_mg: null, d_mcg: null, e_mg: null, k_mcg: null
      },
      minerals: {
        sodium_mg: null, calcium_mg: null, iron_mg: null, copper_mg: null
      },
      // 2. Attach the user's email as the creator
      createdBy: appUser?.email || "unknown_user"
    };

    try {
      // FIXED: Now calling your existing foodApi.createCustom endpoint
      await foodApi.createCustom(newFoodRecord);
      onSaved(newFoodRecord); // Tell the parent component we are done
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
          Can't find it? Add it yourself! Values should be per 100g or 1 standard serving.
        </p>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Dish Name *</label>
            <input required type="text" name="dish_name" value={formData.dish_name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="e.g., Mom's Chicken Curry" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Calories (kcal) *</label>
              <input required type="number" step="0.1" name="calories_kcal" value={formData.calories_kcal} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Protein (g) *</label>
              <input required type="number" step="0.1" name="protein_g" value={formData.protein_g} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Carbs (g) *</label>
              <input required type="number" step="0.1" name="carbohydrates_g" value={formData.carbohydrates_g} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Total Fat (g) *</label>
              <input required type="number" step="0.1" name="fat_total_g" value={formData.fat_total_g} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Sugars (g)</label>
              <input type="number" step="0.1" name="sugars_g" value={formData.sugars_g} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Fiber (g)</label>
              <input type="number" step="0.1" name="dietary_fiber_g" value={formData.dietary_fiber_g} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
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