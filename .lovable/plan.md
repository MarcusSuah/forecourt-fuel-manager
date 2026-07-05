# Role-Scoped Access: Dealer + Supervisor

Split the app so **admins** run the whole system, **dealers** only see their one branch, and **supervisors** only see branches in their assigned zone.

---

## 1. Schema changes (one migration)

- Add enum `zone_type` = `central | north | east | west | south`.
- `branches.zone zone_type` (nullable initially, backfill to `central`).
- `attendants.supervisor_zone zone_type` (used only for supervisor-role users; dealers keep using `branch_id`).
- Helper functions (SECURITY DEFINER):
  - `get_user_zone(uuid)` → `zone_type`
  - `is_supervisor_for_branch(_user_id, _branch_id)` → checks `role='supervisor'` AND branch's zone matches supervisor's zone.
- Update RLS on branch-scoped tables (`branches`, `tanks`, `pumps`, `shift_sales_reports`, `cash_deposits`, `fuel_deliveries`, `stock_readings`, `employees`, `payroll`, `pl_entries`, `attendants`, `tank_pump_assignments`, `islands`, `reconciliation_alerts`) so supervisors get **read-only** access to any branch where `is_supervisor_for_branch(auth.uid(), branch_id)` is true.
- Dealer policies remain as-is (branch-scoped via `get_user_branch`).

## 2. Auto-seed default accounts

Two admin-only edge functions (called from the Admin UI, service-role writes):
- `seed-branch-dealer` → for a branch with no dealer: creates `dealer.<branch-slug>@forecourtms.local` with password `dealer@123`, assigns role `dealer`, links via `attendants.branch_id`.
- `seed-zone-supervisor` → for a zone with no supervisor: creates `sup.<zone>@forecourtms.local` with password `suprse@231`, assigns role `supervisor`, sets `attendants.supervisor_zone`.

Password + email are just first-login defaults; users change them under Settings → Profile (already exists). Admin UI gets two buttons: "Seed missing dealers" and "Seed missing supervisors".

## 3. Sidebar filtering

`src/components/layout/Sidebar.tsx` gets role-based filtering (in addition to existing permission filtering):

- **Dealer** allowed: Dashboard, Tank Management, Tank Dipping, Pump Management, Meter Readings, Shift Stock Report, Sales Entry, Cash Reports, Stock Control, Deliveries, Employees, HRM, Payroll, Profit & Loss, Financial, Reports, Attendants, Notifications, Chat, Settings.
  Hidden: Branches, Analytics, Permissions, Admin, Reconciliation Alerts, Sync Queue, Login Activities.
- **Supervisor** allowed: Dashboard (zone view), Branches (read-only list of their zone), Tank Management, Pump Management, Shift Stock Report, Cash Reports, Deliveries, Employees, Payroll, Profit & Loss, Financial, Reports, Analytics, Notifications, Chat, Settings.
  Hidden: Sales Entry, Meter Readings, Tank Dipping, Permissions, Admin, Sync Queue, Login Activities, Reconciliation Alerts.
- **Admin** unchanged.

## 4. Two new dashboards

Route `/dashboard` renders one of three components based on `user.role`:

- `AdminDashboard` = current `Dashboard.tsx` (renamed, unchanged).
- `DealerDashboard` (new): branch auto-selected via `useDealerBranch`. Shows: today's sales, cash summary, tanks (their branch), pending alerts, HRM headcount, payroll status, P&L snapshot — all filtered by `branch_id`.
- `SupervisorDashboard` (new): 
  - Header shows zone name + branch count.
  - Grid of branch KPI cards (sales today, tank fill %, alert count) for each branch in their zone.
  - Roll-up totals across zone.
  - **Branch switcher** dropdown at top: when a branch is selected, renders the same body as `DealerDashboard` for that branch (read-only).

New hook `useSupervisorZone()` mirrors `useDealerBranch()` and returns `{ isSupervisor, zone, zoneBranches[] }`.

## 5. Route guarding

`ProtectedRoute` extended with an optional `deniedRoles` prop. Wrap admin/permission/sync-queue/login-activity routes with `deniedRoles={['dealer','supervisor']}`, so a dealer who guesses `/admin` gets redirected to `/dashboard` instead of a broken page.

## 6. What we're NOT changing this pass

- Currency, shifts, PouchDB sync, existing offline flow.
- Existing permissions matrix (role gating is layered on top, not replacing).
- The 24 branches aren't created here — admin creates them in Branches; seeding runs after.

---

## Technical notes

- Files touched: `supabase/migrations/*` (new), `supabase/functions/seed-branch-dealer/`, `supabase/functions/seed-zone-supervisor/`, `src/App.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/Dashboard.tsx` (split into 3), `src/pages/DealerDashboard.tsx` (new), `src/pages/SupervisorDashboard.tsx` (new), `src/pages/AdminUsers.tsx` (seed buttons + zone selector when creating supervisors), `src/pages/Branches.tsx` (zone column + editor), `src/hooks/useSupervisorZone.ts` (new).
- Default seeded creds are the first-login defaults you specified; users can change email/password from Settings anytime.
- Supervisors get read access via RLS; dealer edit flows are untouched.

Approve and I'll ship it in order: migration → edge functions → hook + guards → sidebar + dashboards → admin seeding UI.
