# Walkthrough: JWT Authentication & 3-User Persona Architecture

We have successfully implemented role-based JWT authentication across the entire **SmartRail OS** ecosystem:
1. **Passenger Persona** on the **Flutter Mobile App** (Passenger ID & Password sign-in/registration).
2. **Station Operator Persona** on the **Web Command Center** (Station-scoped dashboard, platform metrics, arrivals & alerts for their assigned station).
3. **IT Administrator Persona** on the **Web Command Center** (Global network operations mode with visibility over all 33 stations across Blue & Red corridors, fleet metrics, and admin console).

---

## 👥 The 3 User Personas & Test Credentials

| Persona | Platform | Default ID / Email | Password | Role | Station Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IT Administrator** | Web App | `ADMIN01` / `admin@smartrail.os` | `admin123` | `admin` | **All 33 Stations & Global Network** |
| **Station Operator** | Web App | `OP_BL11` / `operator.bl11@smartrail.os` | `operator123` | `operator` | **Old High Court Interchange (`BL11`)** |
| **Station Operator (Terminus)** | Web App | `OP_BL01` / `operator.bl01@smartrail.os` | `operator123` | `operator` | **Vastral Gam Terminus (`BL01`)** |
| **Passenger Commuter** | Flutter App | `PASS101` / `passenger@smartrail.os` | `pass123` | `passenger` | **Commuter Trip & Coach Heatmap Access** |

---

## 🚀 Key Changes & Architecture

### 1. Backend (`backend/`)
- **User Schema & Model**:
  - [backend/app/models/user.py](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/backend/app/models/user.py): Added `user_id_code` (`PASS101`, `OP_BL11`, `ADMIN01`), `role` (`admin | operator | passenger`), and `station_id` (e.g. `BL11`).
  - [backend/app/schemas/auth.py](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/backend/app/schemas/auth.py): Created `LoginRequest` (identifier + password), `RegisterRequest`, `UserOut`, and `TokenResponse`.
- **JWT Security & FastAPI Dependencies**:
  - [backend/app/core/security.py](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/backend/app/core/security.py): Tokens embed standard `sub` plus claims: `user_id_code`, `email`, `full_name`, `role`, `station_id`.
  - Added dependencies: `get_current_user`, `get_optional_current_user`, `require_roles(["admin", "operator"])`.
- **Auth Endpoints & Seeder**:
  - [backend/app/api/v1/endpoints/auth.py](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/backend/app/api/v1/endpoints/auth.py): Endpoints for `/login`, `/register`, `/me` (`GET` profile), `/refresh`, and `/logout`.
  - [backend/app/db/seeder.py](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/backend/app/db/seeder.py): Automatically seeds default IT Admin (`ADMIN01`), Station Operators (`OP_BL11`, `OP_BL01`), and Passenger (`PASS101`).

### 2. Web Command Center (`smartrailos_web/`)
- **Auth Context & API Client Token Injection**:
  - [smartrailos_web/src/lib/auth-context.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/lib/auth-context.tsx): `AuthProvider`, `useAuth()`, `useIsAdmin()`, `useIsOperator()`, `useOperatorStation()`.
  - [smartrailos_web/src/lib/api/client.ts](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/lib/api/client.ts): Automatically attaches `Authorization: Bearer <token>` from `localStorage` to all API requests.
- **Login & Operator Registration Routes**:
  - [smartrailos_web/src/routes/login.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/routes/login.tsx): Features tabs for Station Operator vs IT Administrator with 1-click quick demo buttons.
  - [smartrailos_web/src/routes/register.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/routes/register.tsx): Operator registration with dropdown selection of all 33 stations across Blue & Red lines.
- **Dashboard Layout & Role-Scoped Experience**:
  - [smartrailos_web/src/routes/dashboard.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/routes/dashboard.tsx): Auth guard with auto-redirect to `/login` for unauthenticated visitors.
  - [smartrailos_web/src/components/srail/dashboard-topnav.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/components/srail/dashboard-topnav.tsx): Role badge, Operator assigned station lock vs IT Admin Global Network mode, and profile menu with sign out.
  - [smartrailos_web/src/components/srail/dashboard-sidebar.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/components/srail/dashboard-sidebar.tsx): Active user role pill (`STATION BL11` or `IT ADMIN`) and quick sign out button.
  - [smartrailos_web/src/routes/dashboard.index.tsx](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_web/src/routes/dashboard.index.tsx): Displays station-scoped console banner when operated by a Station Operator, or global fleet mode when operated by IT Admin.

### 3. Flutter Commuter Mobile App (`smartrailos_app/`)
- **Passenger Model & API Service**:
  - [smartrailos_app/lib/features/auth/models/user_model.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/features/auth/models/user_model.dart): Added `userIdCode`, `role`, and `stationId`.
  - [smartrailos_app/lib/core/services/api_service.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/core/services/api_service.dart): Updated `login`, `register`, `checkAuth` (`GET /api/v1/auth/me`), and `logout` with secure local persistence.
- **Passenger Sign In & Registration Screens**:
  - [smartrailos_app/lib/features/auth/screens/login_screen.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/features/auth/screens/login_screen.dart): Passenger ID / Email login with 1-Click Quick Demo Sign In (`PASS101` / `pass123`).
  - [smartrailos_app/lib/features/auth/screens/register_screen.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/features/auth/screens/register_screen.dart): Passenger registration with optional custom Passenger ID.
- **Router & Profile Integration**:
  - [smartrailos_app/lib/core/router/app_router.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/core/router/app_router.dart): Added `/login` and `/register` routes.
  - [smartrailos_app/lib/features/profile/screens/profile_screen.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/features/profile/screens/profile_screen.dart): Displays Passenger Identity card with Passenger ID badge and Sign Out button.
  - [smartrailos_app/lib/core/widgets/metro_drawer.dart](file:///mnt/7790510d-4770-48c8-8386-0a70be65da14/smrtest/smartrailos_app/lib/core/widgets/metro_drawer.dart): Header and footer reflect logged-in passenger and provide Sign Out action.

---

## 🧪 Verification Results

1. **Backend Test Suite**:
   ```bash
   PYTHONPATH=. pytest tests/ -v
   # Result: 24 passed in 15.02s
   ```
2. **Flutter Static Analysis**:
   ```bash
   flutter analyze
   # Result: Analyzing smartrailos_app... No issues found! (ran in 3.4s)
   ```
3. **Web Command Center Production Build**:
   ```bash
   npm run build
   # Result: ✓ built in 6.86s, 0 errors. All routes generated.
   ```
