# SaharaCare UI redesign record

## Inventory

SaharaCare is a Next.js App Router application using React, TypeScript, Tailwind CSS, Radix primitives, Lucide icons, Framer Motion, Supabase SSR, and a shared English/Nepali translation layer.

The existing user-facing routes covered by the design system are:

- Public: `/`, `/role`, `/login`, `/signup`
- Patient: `/patient`, `/patient/medicines`, `/patient/appointments`, `/patient/appointments/[appointmentId]`, `/patient/medical-information`, `/patient/notifications`, `/patient/assistant`, `/patient/profile`
- Caregiver: `/caregiver`, `/caregiver/patient/[id]`, `/caregiver/notifications`, `/caregiver/assistant`
- Doctor: `/doctor`, `/doctor/availability`, `/doctor/appointments/[appointmentId]`
- Shared role screens: `/settings`
- Administration: `/admin`

Shared UI was already organized around `AppShell`, role sidebars, mobile navigation, `Card`, `Button`, `Modal`, `StatusPill`, data states, skeletons, and translated content. Role-specific dashboard and workflow components sit on top of those foundations.

## Baseline findings

- The original interface used a bright blue primary, slate surfaces, large radii, and generous whitespace.
- The patient bottom navigation contained six destinations, making translated labels crowded on small phones.
- Quick actions were nested in a two-column desktop dashboard area, preventing the intended five-card layout even at wide viewports.
- Several feature forms already had sound labels and large touch targets, but their visual treatments varied.
- Reduced-motion support, text-size controls, focus rings, semantic status text, empty states, skeletons, and English/Nepali translations already existed and were preserved.
- The most frequently used mobile surfaces are the patient dashboard, medication management, appointments, medical information, caregiver patient overview, notifications, and doctor appointments.

## Implemented design system

- Brand: forest green `#083430` / `#13413D` / `#17615A`, teal accents, pale mint `#EAF6F4`, white cards, and mint borders.
- Typography: Arial-first system stack with Noto Sans Devanagari retained for Nepali glyph coverage.
- Cards: 14–22 px radii, thin mint border, restrained green-tinted shadow, and 20–28 px responsive padding.
- Controls: minimum 44 px touch targets, visible teal focus rings, server-confirmed success feedback, and 0.98 pressed states.
- Navigation: five-item patient mobile navigation using existing routes, animated active indicator, safe-area padding, and role-specific desktop sidebars.
- Forms: persistent labels, consistent bordered controls, mobile sticky primary actions for appointment and medical-information flows, and segmented Medical KYC progress.
- Motion: short transitions and a subtle server-confirmed success animation, all disabled by the existing reduced-motion rules.

## Deliberately unchanged

Supabase clients, authentication, authorization, RLS, database policies and migrations, API behavior, appointment permissions, medical-sharing permissions, server validation, medication calculations, notification logic, security headers, environment-variable handling, and data ownership rules were not changed as part of the UI redesign.
