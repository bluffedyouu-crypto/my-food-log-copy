# Design Document — MacroSpace Diet & Macro Tracker

## Architecture Overview

```
my-food-log/
├── src/                          # React frontend (CRA)
│   ├── api/
│   │   └── client.js             # Axios client + all API modules
│   ├── components/
│   │   ├── analytics/
│   │   │   └── AnalyticsPage.js  # Recharts line/bar charts
│   │   ├── auth/
│   │   │   ├── LoginPage.js
│   │   │   └── RegisterPage.js
│   │   ├── bowl/
│   │   │   └── BowlBuilder.js    # dnd-kit drag-and-drop bowl builder
│   │   ├── dashboard/
│   │   │   ├── CustomBowlsPanel.js
│   │   │   ├── Dashboard.js      # Main dashboard with macro rings
│   │   │   ├── FoodSearch.js     # Debounced food search + quantity modal
│   │   │   └── MealCategory.js   # Collapsible meal category rows
│   │   ├── layout/
│   │   │   ├── AppLayout.js      # Sidebar + Outlet wrapper
│   │   │   └── Sidebar.js        # Animated nav sidebar
│   │   ├── onboarding/
│   │   │   └── OnboardingScreen.js  # Animated multi-step onboarding
│   │   ├── settings/
│   │   │   └── SettingsPage.js
│   │   └── ui/
│   │       ├── Button.js
│   │       ├── Card.js
│   │       ├── CircularProgress.js  # SVG animated ring
│   │       ├── Input.js
│   │       └── Modal.js             # Framer Motion frosted-glass modal
│   ├── context/
│   │   ├── AuthContext.js        # Better Auth session + app user state
│   │   └── LogContext.js         # Today's daily log state
│   ├── App.js                    # BrowserRouter + route guards
│   └── index.css                 # Tailwind + custom utilities
│
└── server/                       # Hono backend
    ├── models/
    │   ├── User.js               # Mongoose: profile, targets, weight history
    │   ├── FoodItem.js           # Mongoose: food cache / custom foods
    │   ├── CustomBowl.js         # Mongoose: saved bowl compositions
    │   └── DailyLog.js           # Mongoose: daily food entries + totals
    ├── routes/
    │   ├── users.js              # /api/users — profile, onboarding, settings
    │   ├── food.js               # /api/food — USDA → OFF → MongoDB fallback
    │   ├── logs.js               # /api/logs — daily log CRUD + analytics
    │   └── bowls.js              # /api/bowls — custom bowl CRUD
    ├── utils/
    │   ├── macroCalculator.js    # Mifflin-St Jeor BMR + TDEE + macro splits
    │   └── foodParser.js         # USDA / Open Food Facts normalizer
    ├── auth.js                   # Better Auth initialization
    ├── db.js                     # Mongoose + MongoClient connection
    └── index.js                  # Hono app entry point
```

## Data Flow

### Authentication
1. User signs in via Better Auth (`/api/auth/*`)
2. Session cookie set; frontend calls `/api/users/me` to get app-level user
3. `AuthContext` holds both the Better Auth session and the app `User` document

### Onboarding
1. New user → `OnboardingScreen` (4 animated steps)
2. On submit → `POST /api/users/onboarding`
3. Backend runs `calculateDailyTargets()` (Mifflin-St Jeor) → stores in `User.dailyTargets`
4. Redirect to `/dashboard`

### Food Logging
1. User searches → `GET /api/food/search?q=...`
2. Backend tries USDA FoodData Central → Open Food Facts → MongoDB cache
3. User selects food + quantity → `POST /api/logs/entry`
4. `DailyLog.pre('save')` recalculates totals and per-meal totals
5. Dashboard re-fetches today's log → progress rings update

### Bowl Builder
1. User drags food from sidebar → drops on bowl SVG (dnd-kit)
2. Frosted-glass modal asks for quantity
3. Ingredient added to local state with calculated nutrition
4. On save → `POST /api/bowls` → stored in MongoDB
5. From dashboard → "Log This Bowl" → logs each ingredient as separate entries

## Macro Calculation

Uses **Mifflin-St Jeor** formula:
- Male BMR: `10W + 6.25H - 5A + 5`
- Female BMR: `10W + 6.25H - 5A - 161`

TDEE = BMR × activity multiplier (1.2–1.725)

Goal adjustments:
- Fat Loss: −500 kcal
- Muscle Gain: +300 kcal
- Recomp / Maintenance: ±0

Macro splits by goal:
| Goal | Protein | Carbs | Fats |
|------|---------|-------|------|
| Fat Loss | 35% | 35% | 30% |
| Muscle Gain | 30% | 45% | 25% |
| Recomp | 35% | 40% | 25% |
| Maintenance | 25% | 50% | 25% |

## Meal Categories

| Key | Display Name | Time |
|-----|-------------|------|
| `early_fuel` | Early Fuel | 5–7 AM |
| `daybreak_nourish` | Daybreak Nourish | 7–9 AM |
| `morning_boost` | Morning Boost | 10–11 AM |
| `midday_reset` | Midday Reset | 12–2 PM |
| `afternoon_graze` | Afternoon Graze | 3–5 PM |
| `evening_fuel` | Evening Fuel | 6–8 PM |
| `twilight_graze` | Twilight Graze | 9–10 PM |

## Color Palette (Deep Space)

| Token | Value | Usage |
|-------|-------|-------|
| `#000000` | True black | Page background |
| `#0B0F19` | Deep navy | Card backgrounds |
| `#111827` | Dark blue-gray | Card gradient start |
| `#1a2235` | Slightly lighter | Card gradient end |
| `#6366f1` | Indigo | Primary accent, calories |
| `#22d3ee` | Cyan | Protein |
| `#f59e0b` | Amber | Carbs |
| `#f472b6` | Pink | Fats |
| `#a78bfa` | Violet | Weight trend |

## Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.x | Backend web framework |
| `@hono/node-server` | ^2.x | Node.js adapter for Hono |
| `better-auth` | ^1.x | Authentication (email + Google OAuth) |
| `mongoose` | ^9.x | MongoDB ODM |
| `framer-motion` | latest | All animations |
| `@dnd-kit/core` | latest | Drag-and-drop in Bowl Builder |
| `recharts` | latest | Analytics charts |
| `react-router-dom` | latest | Client-side routing |
| `tailwindcss` | ^3.x | Utility-first styling |
| `axios` | latest | HTTP client |
