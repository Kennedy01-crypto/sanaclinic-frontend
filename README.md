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

## Deployment and CI/CD

The frontend production URL is not yet confirmed; add the verified public URL here after the Vercel project is deployed.

The GitHub Actions workflow is [`.github/workflows/ci-cd.yml`](./.github/workflows/ci-cd.yml). Pull requests targeting `main` and pushes to `main` run ESLint and a production build. Vercel's Git integration independently deploys production from `main`; GitHub Actions only validates the code and does not deploy.

No Vercel deployment secrets are needed in GitHub Actions. Require the `lint-and-build` status check before merging pull requests and protect `main` from direct pushes if production changes must always pass CI. Configure `NEXT_PUBLIC_API_URL=https://sanaclinic-backend.vercel.app/api` and `NEXT_PUBLIC_DJANGO_URL=https://sanaclinic-backend.vercel.app` in the Vercel project environment. See the backend README for API deployment configuration and the cross-site cookie authentication consideration.
