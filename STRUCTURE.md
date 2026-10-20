# Frontend structure

```text
frontend/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata, and global stylesheet
│   ├── page.tsx            # Home route that mounts the role-aware portal
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminPortal.tsx   # Staff dashboard and appointment/doctor/patient/schedule management
│   │   └── patient/
│   │       └── PatientPortal.tsx # Patient auth, overview, booking, appointments, and profile
│   ├── lib/
│   │   └── api.ts          # Cookie-authenticated API client and shared account types
│   ├── globals.css         # Global, patient, and admin portal styles
│   └── favicon.ico         # Browser tab icon
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg          # Static assets from the Next.js starter
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
├── postcss.config.mjs      # PostCSS/Tailwind integration
├── package.json            # Runtime dependencies and npm scripts
└── package-lock.json       # Locked npm dependency tree
```

Generated and installed directories such as `node_modules/` and `.next/` are intentionally omitted from this tree.

## Technology

The app uses the Next.js App Router with React and TypeScript. Tailwind CSS provides the styling setup; Lucide icons and React Toastify support the portal UI. The frontend loads the read-only role from the authenticated Django `/me/` endpoint and routes staff users to the admin dashboard, while non-staff users receive the patient portal. Administrative operations use staff-protected API endpoints; the sidebar provides overview, appointment, doctor, patient, and schedule pages. Doctors remain records rather than login accounts.

See [README.md](./README.md) for available scripts and [../RUN.md](../RUN.md) for local setup.
