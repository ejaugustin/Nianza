# Nianza

Nianza is a voice-first parenthood companion app for parents of children from birth through the early school years. Its central voice is Patricia, a warm grandmother persona who supports parents with development guidance, milestone tracking, vaccine reminders, visit preparation, and calm boundaries around medical questions.

This repository is organized as a monorepo:

- `MobileApp/` — Expo / React Native mobile application
- `AdminPortal/` — Vite / React internal admin portal
- `Backend/` — AWS serverless backend and infrastructure
- `docs/` — implementation notes and source-document index

## First Build Goal

The first vertical slice is:

1. Admin creates, reviews, and approves a Patricia content item.
2. Mobile onboarding creates a parent and child profile.
3. Home displays an approved Patricia note for the active child.

That path proves the content approval gate, authenticated app access, child context, and design system before broader feature expansion.

## Safety Principles

- Nianza is not a medical app.
- The app records vitals but does not interpret them.
- Child and parent data stay separated by design.
- Patricia redirects medical questions to the child's doctor without alarm.
- Every admin write is audit logged.
