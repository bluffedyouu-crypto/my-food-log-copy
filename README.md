# 🔥 Shredd — Diet & Macro Tracker

A modern, highly interactive diet and macro tracking web application with a "Deep Space" dark UI, animated onboarding, drag-and-drop meal builder, and real-time progress visualization.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 3, Framer Motion |
| Drag & Drop | dnd-kit |
| Charts | Recharts |
| Backend | Hono (Node.js adapter) |
| Auth | Better Auth (email/password + Google OAuth) |
| Database | MongoDB + Mongoose |
| Food API | USDA FoodData Central → Open Food Facts → MongoDB fallback |

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (or a MongoDB Atlas URI)

### 1. Install dependencies

```bash
# Frontend deps
npm install

# Backend deps
npm install --prefix server
```

### 2. Configure environment

Copy and edit the server env file:
```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/shredd
BETTER_AUTH_SECRET=your-long-random-secret
BETTER_AUTH_URL=http://localhost:5000
GOOGLE_CLIENT_ID=your-google-client-id       # optional
GOOGLE_CLIENT_SECRET=your-google-client-secret  # optional
USDA_API_KEY=DEMO_KEY                         # or get a free key at api.nal.usda.gov
PORT=5000
```

Edit `.env` (frontend):
```env
REACT_APP_API_URL=http://localhost:5000
```

### 3. Run in development

```bash
# Run both frontend and backend concurrently
npm run dev
```

Or separately:
```bash
npm run server:dev   # Hono backend on :5000
npm start            # React frontend on :3000
```

## Features

### 🎯 Animated Onboarding
4-step animated flow (Framer Motion fade-in) collecting:
- Primary goal (Fat Loss / Muscle Gain / Recomp / Maintenance)
- Body metrics (age, weight, height, gender)
- Activity level
- Meal frequency (3–6 meals)

Automatically calculates daily calorie target and macro splits using the **Mifflin-St Jeor** formula.

### 📊 Dashboard
- Animated circular progress rings for Calories, Protein, Carbs, Fats
- 7 trendy meal categories (Early Fuel → Twilight Graze)
- Real-time food search (USDA API with fallback)
- One-click Custom Bowl logging

### 🥣 Custom Bowl Builder
- Drag food items from a searchable sidebar into an interactive bowl graphic
- Frosted-glass quantity modal on drop
- Live nutrition totals
- Save named bowls for reuse

### 📈 Analytics
- 7/14/30-day calorie adherence bar chart
- Macro trend line chart
- Weight trend line chart with goal reference line

### ⚙️ Settings
- Update goals, weight, activity level
- Manual macro target override
- Weight logging

## Project Structure

```
shredd/
├── src/                  # React frontend
│   ├── api/              # Axios API client
│   ├── components/       # UI components by feature
│   ├── context/          # Auth + Log React contexts
│   └── App.js            # Router + route guards
└── server/               # Hono backend
    ├── models/           # Mongoose schemas
    ├── routes/           # API route handlers
    ├── utils/            # Macro calculator + food parser
    ├── auth.js           # Better Auth setup
    └── index.js          # Server entry point
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/api/auth/**` | Better Auth (sign-in, sign-up, session) |
| `GET` | `/api/users/me` | Get current user profile |
| `POST` | `/api/users/onboarding` | Complete onboarding + calculate targets |
| `PATCH` | `/api/users/settings` | Update settings / override targets |
| `GET` | `/api/food/search?q=` | Search food (USDA → OFF → cache) |
| `GET` | `/api/logs/today` | Get today's log |
| `POST` | `/api/logs/entry` | Add food entry |
| `DELETE` | `/api/logs/entry/:id` | Remove food entry |
| `GET` | `/api/logs/analytics/summary` | Analytics data |
| `GET/POST` | `/api/bowls` | List / create custom bowls |
| `PATCH/DELETE` | `/api/bowls/:id` | Update / delete bowl |

## USDA API Key

The app uses `DEMO_KEY` by default (limited to 30 requests/hour). Get a free key at [api.nal.usda.gov](https://api.nal.usda.gov/signup) for 1000 requests/hour.
