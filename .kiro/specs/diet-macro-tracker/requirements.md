# Requirements Document

## Introduction

The Diet and Macro Tracker is a modern, highly interactive web application that enables users to track their daily food intake, monitor macronutrient consumption, and achieve their fitness goals through an intuitive interface with drag-and-drop meal building, real-time progress visualization, and personalized nutritional targets.

## Glossary

- **System**: The Diet and Macro Tracker web application
- **User**: A person using the application to track their diet and macros
- **Macro**: Macronutrient (Protein, Carbohydrates, or Fats)
- **Micro**: Micronutrient (vitamins and minerals)
- **Daily_Target**: The calculated daily caloric and macronutrient goals for a User
- **Meal_Category**: A time-based eating occasion (Early Fuel, Daybreak Nourish, Morning Boost, Midday Reset, Afternoon Graze, Evening Fuel, Twilight Graze)
- **Custom_Bowl**: A user-created meal composed of multiple food items saved for reuse
- **Food_Item**: A single food entry from the external food database or MongoDB fallback
- **Daily_Log**: A record of all food consumed by a User on a specific date
- **Onboarding**: The initial setup process where Users provide body metrics and goals
- **Food_API**: External food database service (Open Food Facts, Edamam, or USDA FoodData Central)
- **Progress_Bar**: A circular visual indicator showing percentage of Daily_Target consumed
- **Bowl_Builder**: The interactive interface for creating Custom_Bowls via drag-and-drop
- **Authentication_Provider**: Better Auth service handling user authentication
- **Frontend**: React-based user interface with Tailwind CSS and Framer Motion
- **Backend**: Hono web framework server with MongoDB database
- **Deep_Space_Theme**: Dark mode color palette with true black background and dark bluish-purple gradients

## Requirements

### Requirement 1: User Authentication

**User Story:** As a User, I want to securely authenticate using Google OAuth or email/password, so that my dietary data is private and accessible only to me.

#### Acceptance Criteria

1. THE Authentication_Provider SHALL support Google OAuth 2.0 authentication
2. THE Authentication_Provider SHALL support email and password authentication
3. WHEN a User successfully authenticates, THE System SHALL create or retrieve the User's account
4. WHEN authentication fails, THE System SHALL display a descriptive error message
5. THE System SHALL maintain User session state across page refreshes
6. WHEN a User logs out, THE System SHALL clear the session and redirect to the login page

### Requirement 2: Onboarding Flow

**User Story:** As a new User, I want to complete an animated onboarding process, so that the System can calculate my personalized Daily_Target.

#### Acceptance Criteria

1. WHEN a new User first accesses THE System, THE Frontend SHALL display a blank screen with animated questions appearing one by one
2. THE Frontend SHALL use Framer Motion fade-in animations with smooth text easing for each onboarding question
3. THE System SHALL collect the following data in sequence: Primary Goal (Fat Loss, Lean Muscle Gain, Recomp, Maintenance), Age, Current Weight, Target Weight, Height, Gender, Activity Level (Sedentary, Lightly Active, Moderately Active, Very Active), and Meal Frequency (3-6 meals per day)
4. WHEN all onboarding data is collected, THE Backend SHALL calculate Daily_Target for calories, Protein, Carbohydrates, Fats, and Micros
5. THE Backend SHALL store the User's onboarding data and Daily_Target in the MongoDB database
6. WHEN onboarding is complete, THE System SHALL redirect the User to the dashboard

### Requirement 3: Daily Target Calculation

**User Story:** As a User, I want the System to calculate my Daily_Target based on my goals and body metrics, so that I have accurate nutritional targets.

#### Acceptance Criteria

1. WHEN calculating Daily_Target, THE Backend SHALL use the User's Age, Current Weight, Target Weight, Height, Gender, Activity Level, and Primary Goal
2. THE Backend SHALL calculate total daily caloric target within 50 calories of standard metabolic formulas
3. THE Backend SHALL calculate Macro splits (Protein, Carbohydrates, Fats) as percentages that sum to 100% of total calories
4. THE Backend SHALL calculate Micro targets based on recommended daily allowances
5. FOR ALL valid User inputs, THE Backend SHALL produce a Daily_Target with positive calorie and Macro values

### Requirement 4: Dashboard Display

**User Story:** As a User, I want to view my daily progress on a dashboard, so that I can monitor my adherence to my Daily_Target.

#### Acceptance Criteria

1. THE Frontend SHALL display today's total calories consumed versus Daily_Target calories
2. THE Frontend SHALL display three circular Progress_Bars showing percentage consumed for Protein, Carbohydrates, and Fats
3. WHEN a User consumes food that exceeds Daily_Target, THE Progress_Bar SHALL indicate over-consumption with a visual change
4. THE Frontend SHALL update Progress_Bars in real-time when food is logged
5. THE Frontend SHALL apply Deep_Space_Theme styling to all dashboard components

### Requirement 5: Food Search and Logging

**User Story:** As a User, I want to search for foods and quickly log them to Meal_Categories, so that I can track my intake efficiently.

#### Acceptance Criteria

1. THE Frontend SHALL display a search bar on the dashboard
2. WHEN a User types in the search bar, THE Backend SHALL query the Food_API for matching Food_Items
3. WHEN the Food_API is unavailable, THE Backend SHALL query the MongoDB fallback database
4. THE Frontend SHALL display search results with food name, serving size, and macronutrient information
5. WHEN a User selects a Food_Item, THE Frontend SHALL prompt for quantity selection (grams, ounces, or servings)
6. WHEN a User confirms quantity, THE System SHALL log the Food_Item to the selected Meal_Category
7. THE System SHALL update the Daily_Log and Progress_Bars immediately after logging

### Requirement 6: Meal Categories

**User Story:** As a User, I want to organize my food intake by Meal_Categories with trendy names, so that I can track when I eat throughout the day.

#### Acceptance Criteria

1. THE System SHALL support seven Meal_Categories: Early Fuel, Daybreak Nourish, Morning Boost, Midday Reset, Afternoon Graze, Evening Fuel, and Twilight Graze
2. THE Frontend SHALL display all Meal_Categories on the dashboard
3. WHEN a User logs food, THE System SHALL associate the Food_Item with exactly one Meal_Category
4. THE Frontend SHALL display total calories and Macros for each Meal_Category
5. THE System SHALL allow Users to log food to any Meal_Category regardless of current time

### Requirement 7: Custom Bowl Builder

**User Story:** As a User, I want to build custom meals using drag-and-drop, so that I can save and reuse complex meal combinations.

#### Acceptance Criteria

1. THE Frontend SHALL provide a dedicated route for the Bowl_Builder interface
2. THE Frontend SHALL display a large interactive bowl graphic as the drop target
3. THE Frontend SHALL display a searchable sidebar with draggable Food_Items
4. WHEN a User drags a Food_Item onto the bowl graphic, THE Frontend SHALL display a frosted-glass popup for quantity selection
5. THE Frontend SHALL support quantity input in grams, ounces, and servings
6. WHEN a User adds multiple Food_Items to the bowl, THE Frontend SHALL calculate and display total calories and Macros
7. WHEN a User saves a Custom_Bowl, THE Backend SHALL store it in the MongoDB database with a user-provided name
8. THE System SHALL allow Users to log a saved Custom_Bowl to any Meal_Category with one click

### Requirement 8: Custom Bowl Management

**User Story:** As a User, I want to view and manage my saved Custom_Bowls, so that I can reuse favorite meals.

#### Acceptance Criteria

1. THE Frontend SHALL display a "My Custom Bowls" section accessible from the dashboard
2. THE Frontend SHALL list all Custom_Bowls created by the User with name, total calories, and Macro breakdown
3. WHEN a User selects a Custom_Bowl, THE Frontend SHALL display all Food_Items and quantities in the bowl
4. THE System SHALL allow Users to edit existing Custom_Bowls
5. THE System SHALL allow Users to delete Custom_Bowls
6. WHEN a User logs a Custom_Bowl, THE System SHALL add all Food_Items to the selected Meal_Category

### Requirement 9: Analytics and Progress Tracking

**User Story:** As a User, I want to view visual analytics of my progress, so that I can understand my adherence trends over time.

#### Acceptance Criteria

1. THE Frontend SHALL provide a dedicated analytics route
2. THE Frontend SHALL display a line chart showing weight trends over time using Recharts or Chart.js
3. THE Frontend SHALL display a bar chart showing daily caloric adherence (consumed vs target) for the past 30 days
4. THE Frontend SHALL display average Macro adherence percentages over the past 7 days and 30 days
5. WHEN insufficient data exists for a chart, THE Frontend SHALL display a message indicating more data is needed
6. THE Frontend SHALL apply Deep_Space_Theme styling to all charts and analytics components

### Requirement 10: Settings and Goal Management

**User Story:** As a User, I want to update my goals and body metrics, so that my Daily_Target remains accurate as I progress.

#### Acceptance Criteria

1. THE Frontend SHALL provide a settings route accessible from the dashboard
2. THE System SHALL allow Users to update Current Weight, Target Weight, Activity Level, and Primary Goal
3. WHEN a User updates body metrics or goals, THE Backend SHALL recalculate Daily_Target
4. THE System SHALL allow Users to manually override calculated Daily_Target values for calories, Protein, Carbohydrates, and Fats
5. WHEN a User manually overrides Daily_Target, THE System SHALL use the override values instead of calculated values
6. THE Backend SHALL store all settings changes in the MongoDB database

### Requirement 11: Data Persistence

**User Story:** As a User, I want my data to persist across sessions, so that I can access my history and progress at any time.

#### Acceptance Criteria

1. THE Backend SHALL store User profiles in MongoDB using Mongoose schemas
2. THE Backend SHALL store Daily_Logs with date, Meal_Category, Food_Items, and quantities
3. THE Backend SHALL store Custom_Bowls with name, Food_Items, and quantities
4. THE Backend SHALL store weight entries with date and weight value
5. WHEN a User logs in, THE System SHALL retrieve all historical data associated with the User's account
6. THE Backend SHALL ensure data integrity by validating all database writes

### Requirement 12: Food Database Integration

**User Story:** As a User, I want access to a comprehensive food database, so that I can find and log any food I consume.

#### Acceptance Criteria

1. THE Backend SHALL integrate with at least one Food_API (Open Food Facts, Edamam, or USDA FoodData Central)
2. WHEN the Food_API returns results, THE Backend SHALL parse and format nutritional data (calories, Protein, Carbohydrates, Fats, Micros)
3. WHEN the Food_API is unavailable or returns no results, THE Backend SHALL query the MongoDB fallback database
4. THE Backend SHALL cache frequently searched Food_Items in MongoDB to reduce API calls
5. THE System SHALL allow Users to manually add custom Food_Items to their personal database

### Requirement 13: User Interface Animations

**User Story:** As a User, I want smooth, professional animations throughout the interface, so that the application feels modern and polished.

#### Acceptance Criteria

1. THE Frontend SHALL use Framer Motion for all screen transitions
2. THE Frontend SHALL apply fade-in animations to page loads with duration between 200ms and 500ms
3. THE Frontend SHALL apply smooth easing functions to text animations
4. WHEN navigating between routes, THE Frontend SHALL animate the transition with fade effects
5. THE Frontend SHALL animate Progress_Bar updates with smooth transitions
6. THE Frontend SHALL apply hover and click animations to interactive elements

### Requirement 14: Responsive Design

**User Story:** As a User, I want the application to work on desktop and mobile devices, so that I can track my diet anywhere.

#### Acceptance Criteria

1. THE Frontend SHALL use Tailwind CSS responsive utilities for all layouts
2. THE Frontend SHALL display a mobile-optimized layout on screens smaller than 768px width
3. THE Frontend SHALL display a desktop-optimized layout on screens 768px width or larger
4. WHEN on mobile, THE Bowl_Builder SHALL adapt drag-and-drop to touch interactions
5. THE Frontend SHALL ensure all text is readable and all interactive elements are tappable on mobile devices

### Requirement 15: Error Handling

**User Story:** As a User, I want clear error messages when something goes wrong, so that I understand what happened and how to proceed.

#### Acceptance Criteria

1. WHEN the Food_API fails, THE System SHALL display a message indicating the search is using cached data
2. WHEN the Backend is unreachable, THE Frontend SHALL display a connection error message
3. WHEN a User submits invalid data, THE Frontend SHALL display field-specific validation errors
4. WHEN authentication fails, THE System SHALL display the reason for failure (invalid credentials, network error, etc.)
5. THE System SHALL log all errors to the Backend for debugging purposes
6. WHEN a database operation fails, THE Backend SHALL return a descriptive error response to the Frontend

### Requirement 16: Parser and Serializer for Food Data

**User Story:** As a developer, I want to parse and serialize food data from external APIs, so that the System can consistently store and retrieve nutritional information.

#### Acceptance Criteria

1. WHEN food data is received from the Food_API, THE Parser SHALL parse it into a standardized Food_Item object
2. WHEN the Food_API returns invalid or incomplete data, THE Parser SHALL return a descriptive error
3. THE Pretty_Printer SHALL format Food_Item objects back into the Food_API's expected format
4. FOR ALL valid Food_Item objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. THE Parser SHALL handle missing optional fields by providing default values

### Requirement 17: Parser and Serializer for Custom Bowls

**User Story:** As a developer, I want to parse and serialize Custom_Bowl data, so that the System can store and retrieve complex meal compositions.

#### Acceptance Criteria

1. WHEN a Custom_Bowl is saved, THE Serializer SHALL convert it into a MongoDB-compatible document
2. WHEN a Custom_Bowl is retrieved, THE Parser SHALL parse the MongoDB document into a Custom_Bowl object
3. THE Pretty_Printer SHALL format Custom_Bowl objects for display in the Frontend
4. FOR ALL valid Custom_Bowl objects, serializing then deserializing SHALL produce an equivalent object (round-trip property)
5. THE Parser SHALL validate that all Food_Items in a Custom_Bowl have valid quantities

### Requirement 18: Parser and Serializer for Daily Logs

**User Story:** As a developer, I want to parse and serialize Daily_Log data, so that the System can accurately track daily food intake.

#### Acceptance Criteria

1. WHEN a Daily_Log is created or updated, THE Serializer SHALL convert it into a MongoDB-compatible document with date, Meal_Categories, and Food_Items
2. WHEN a Daily_Log is retrieved, THE Parser SHALL parse the MongoDB document into a Daily_Log object
3. THE Pretty_Printer SHALL format Daily_Log objects for display in analytics and dashboard views
4. FOR ALL valid Daily_Log objects, serializing then deserializing SHALL produce an equivalent object (round-trip property)
5. THE Parser SHALL ensure that all Food_Items in a Daily_Log have valid timestamps and Meal_Category associations
