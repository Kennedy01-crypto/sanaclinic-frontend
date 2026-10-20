# Frontend

The frontend is a Next.js application using the App Router and TypeScript. It provides a patient portal for sign-in/registration, appointments, booking, cancellation, rescheduling, and profile/password settings, plus a role-aware admin dashboard with dedicated appointment, doctor, patient, and schedule management pages. Django's `is_staff` flag determines whether the authenticated account receives the `admin` or `patient` role; doctors do not have separate login accounts in the current design.

## Tech stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9 with the Next.js configuration

Exact dependency versions and commands are defined in [package.json](./package.json), with npm dependency resolution captured in [package-lock.json](./package-lock.json).

## Run

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. For complete backend and frontend startup instructions, see [../RUN.md](../RUN.md).

## Scripts

- `npm run dev` — start the development server.
- `npm run lint` — run ESLint.
- `npm run build` — create a production build.
- `npm run start` — serve a previously built production app.

## Main files

- `app/page.tsx`: role-aware portal route.
- `app/components/patient/PatientPortal.tsx`: authentication and patient workspace.
- `app/components/admin/AdminPortal.tsx`: staff dashboard and clinic management pages.
- `app/lib/api.ts`: shared cookie-authenticated API client and account types.
- `app/layout.tsx`: shared root layout and page metadata.
- `app/globals.css`: global styles and Tailwind import.

The patient and administrator dashboards call the Django API at `http://localhost:8000/api` by default. Set `NEXT_PUBLIC_API_URL` in the frontend environment to override that base URL. Admin management endpoints require a Django staff account.
