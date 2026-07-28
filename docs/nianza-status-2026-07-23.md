# Nianza Project Status

Date: July 23, 2026

This summary captures where the Nianza app, backend, and admin portal stand after the current implementation push. It focuses on what has been implemented, what is deployed or partially wired, known issues, and what remains.

## Current Product Direction

Nianza is a parenting companion app. Patricia is the core experience: a warm, voice-first parenting guide who follows the parent across the app, remembers context, and helps interpret milestones, vaccines, vitals, reports, and daily notes without feeling like a separate chatbot destination.

The product principle that has emerged clearly:

- Less reading, more conversation.
- Patricia should be one consistent voice throughout the app.
- Context should travel with the parent. If a parent enters from a milestone, vaccine, sick day, weekly letter, or daily note, Patricia should already understand that context.
- The app should feel calm, navigable, and forgiving for tired, anxious parents.

## Repository Structure

Primary repo:

- `C:\Users\eja\Nianza`

Main areas:

- `MobileApp/`: Expo React Native mobile app.
- `AdminPortal/`: Vite admin portal.
- `Backend/`: AWS SAM backend.
- `Brand_Assets/`: Nianza logo and lockup assets.
- `docs/`: implementation notes and project summaries.
- `MobileApp/Nianza Screens v3/svg/`: visual screen references.

## Implemented Foundation

The project has been initialized as a monorepo and connected to GitHub:

- GitHub repo: `ejaugustin/Nianza`
- GitHub Actions checks are running and generally green.
- Work has been organized through short PR slices.
- Multiple feature branches have been merged into `main`.

Recent merged PRs include:

- Foundation scaffold.
- Admin content approval.
- Admin auth and deployment wiring.
- Mandatory AWS tag/SCP compliance.
- Mobile approved content delivery.
- Mobile auth and onboarding wiring.
- Contextual Patricia chat.
- Milestones, vaccines, reports, vitals foundations.
- Patricia voice/chat timing and safety fixes.
- Contextual home note entry.

## Backend Implemented

Backend is SAM/CloudFormation based.

Current deployed stack:

- Stack name: `nianza-backend-prod`
- Region: `us-east-2`
- AWS profile: `nianza-prod`

Known outputs from the deployed stack:

- `AdminApiUrl`: `https://h3au1bu1xl.execute-api.us-east-2.amazonaws.com/prod/admin/v1`
- `MobileApiUrl`: `https://gr8d5s0yl9.execute-api.us-east-2.amazonaws.com/prod/mobile/v1`
- `AdminUserPoolId`: `us-east-2_NJO6sYCoK`
- `AdminUserPoolClientId`: `1sb2jpf55i5ct3unl9cr6mmknm`
- `ContentLibraryTableName`: `nianza-content-library-prod`

Implemented backend areas:

- Admin content library endpoints.
- Admin Cognito user pool and admin authorizer.
- Mobile Cognito user pool support.
- Approved mobile content delivery.
- Child/profile sync foundation.
- Milestone progress endpoints with rollover/backfill behavior using `child.createdAt`.
- Vaccine status/progress foundation.
- Reports contract foundation.
- Vitals logging foundation.
- Settings API foundation.
- Patricia chat endpoint with ambient context support.
- Deepgram TTS/STT configuration parameters.
- Anthropic/Claude integration shell.
- Safety handling templates and false-positive guard refinements.

Backend secrets/config:

- Deepgram API key is intended to be passed through deployment parameters or stored securely.
- Anthropic API key/model parameters were added to SSM manually.
- The app should not expose backend AI/STT/TTS keys directly to the client.

## Admin Portal Implemented

The admin portal is a Vite app under `AdminPortal/`.

Implemented:

- Admin login using Cognito.
- Admin identity role support, including `super_admin`.
- Content creation.
- Content clinical review.
- Ej approval flow.
- Real API connection to the deployed backend.
- Approved content can be fetched by the mobile content endpoint.

Local admin env values used:

```env
VITE_ADMIN_API_URL=https://h3au1bu1xl.execute-api.us-east-2.amazonaws.com/prod/admin/v1
VITE_ADMIN_COGNITO_REGION=us-east-2
VITE_ADMIN_COGNITO_USER_POOL_ID=us-east-2_NJO6sYCoK
VITE_ADMIN_COGNITO_CLIENT_ID=1sb2jpf55i5ct3unl9cr6mmknm
```

Verified flow:

- Admin portal can approve content.
- Mobile content endpoint returned approved daily note data.

## Mobile App Implemented

The mobile app is Expo Router based.

Implemented mobile areas:

- Real Nianza branding and logo/leaf integration.
- Splash/welcome/auth screens.
- Mobile Cognito auth.
- Register, confirm email/code, login, forgot/reset password foundation.
- Session persistence using secure storage.
- Multi-step onboarding flow replacing the earlier single form.
- Onboarding collects parent and child data before Home renders.
- Home screen based on Nianza visual references.
- Bottom tabs: Home, Milestones, Vaccines, Reports, Settings.
- Chat tab removed as requested.
- Floating “Talk to Patricia” button added to core screens.
- Contextual Patricia entry points.
- Home daily note.
- Daily note “Discuss with Patricia” behavior was implemented in the latest PR slice.
- Patricia chat screen with back navigation.
- Patricia replay buttons on assistant messages.
- Voice-first chat UI with mic/recording tray.
- Deepgram voice endpoint usage for Patricia voice in key places.
- Mock/partial STT workflow.
- Patricia “thinking”/voice timing work.
- Keyboard avoidance fixes for chat.
- Markdown cleanup so Patricia does not speak formatting characters like `**` as “star”.

Mobile env:

```env
EXPO_PUBLIC_API_URL=https://gr8d5s0yl9.execute-api.us-east-2.amazonaws.com/prod/mobile/v1
EXPO_PUBLIC_COGNITO_REGION=us-east-2
EXPO_PUBLIC_COGNITO_USER_POOL_ID=<mobile-user-pool-id>
EXPO_PUBLIC_COGNITO_CLIENT_ID=<mobile-client-id>
```

## Patricia / Chat Implemented

Implemented:

- Patricia is treated as the fabric of the app, not just a navigation tab.
- `PatriciaContext` / `ChatContextSeed` concept added.
- Chat routes accept contextual params such as source, event type, entity id, and child id.
- Floating Patricia button can open chat.
- Contextual doors can open Patricia with richer context.
- Home note entry can pass daily note context.
- Patricia has replayable voice messages.
- Backend chat supports ambient context.
- Safety false positives were addressed after the model repeatedly returned emergency/self-harm style responses to normal parenting questions.
- Deepgram model selected for TTS: `aura-2-cordelia-en`.
- STT model selected: `nova-2`.

Still incomplete:

- Fully real STT upload/transcription path from the phone to backend.
- Persistent conversation memory on the backend.
- Rich conversation history retrieval when the user taps generic “Talk to Patricia”.
- True streaming text/audio response.
- More robust safety classification.
- Golden conversation tests expanded beyond initial cases.

## Milestones Implemented

Implemented:

- Milestone content library imported from local milestone references.
- Milestone progress backend.
- Honest rollover/backfill using `child.createdAt`.
- Milestone checkboxes toggle.
- “Things to watch for” assignment added.
- “Tell Patricia” contextual prompt direction established.

Still needed:

- Full clinical content QA for all milestone text.
- Full mobile milestone state sync against deployed backend for all children.
- More polished visual alignment with all milestone SVG screens.
- Deeper Patricia context when entering from specific checked milestones or watch-for items.

## Vaccines Implemented

Implemented:

- Vaccine content reference added from `vaccines-en.json`.
- Vaccine progress/status backend contract.
- Vaccine screen foundation.
- Reports contract connected to vaccine status direction.
- Contextual Patricia entry from vaccine screens.

Known issue:

- The app has shown “Vaccine notes need a connection” and 502/internal errors during testing. This was tied to backend deployment/version/token/profile sync issues and may require another backend deploy plus fresh mobile login/session.

Still needed:

- Verify deployed vaccine endpoints with a valid mobile Cognito token.
- Ensure child profile sync completes before vaccine fetch.
- Add graceful retry/error details for testers.
- Complete all vaccine record states: due, completed, deferred, skipped, doctor-plan override.
- Add Patricia vaccine answer acceptance tests.

## Vitals Implemented

Implemented:

- Vitals screen foundation.
- Sick day / active encounter concept.
- Recent entries UI direction.
- Ask Patricia about a sick encounter.
- Vitals logging backend foundation.

Still needed:

- Fully wire vitals create/read/update flows to backend.
- Add real forms for temperature, feeding, sleep, diapers, symptoms, notes.
- Add active encounter start/end flow.
- Add growth tracking only once verified LMS seed is available.
- Improve navigation on every detail screen.

## Reports Implemented

Implemented:

- Reports screen foundation.
- Weekly Letter UI direction.
- Weekly letters are collapsible so 52+ letters do not overwhelm the screen.
- Weekly letters are from Patricia, so the letter body should use first person “I” rather than saying “Patricia”.
- Patricia voice playback direction for letters.

Still needed:

- Persist weekly letters.
- Email weekly letters.
- Backend scheduled generation.
- Reports export/share flows.
- Growth/report charts after verified data support.

## Settings Implemented

Implemented:

- Settings tab added after Reports.
- Basic settings UI foundation.
- Profile/settings API foundation.

Still needed:

- Editable parent profile.
- Editable child profile.
- Notification settings.
- Language settings.
- Privacy and data export/delete.
- Sign out and account switching hardening.

## Current Testing / Local Dev Issues

Repeated testing friction has been around Expo dev server connectivity:

- Phone sometimes tries `exp://127.0.0.1:8082`, which cannot work from a physical phone.
- Phone sometimes tries VPN or alternate adapter IPs such as `10.110.134.206`.
- Correct LAN IPv4 from Windows Wi-Fi is `192.168.1.226`.
- The phone has timed out connecting to `192.168.1.226:8082`.
- Windows firewall rule creation failed because PowerShell was not elevated.
- Running with `--localhost` is not correct for physical iPhone testing.

Recommended physical device command:

```powershell
cd C:\Users\eja\Nianza\MobileApp
npx expo start --clear --lan --port 8082
```

If the phone cannot reach it:

- Confirm phone and PC are on the same Wi-Fi and not guest/client-isolated Wi-Fi.
- Disable VPN/security filtering temporarily.
- Allow Node.js through Windows Firewall, or run elevated PowerShell and add an inbound rule for port `8082`.
- Test from phone browser: `http://192.168.1.226:8082`.
- If LAN remains unreliable, use tunnel once ngrok connects, or create an Expo dev build/EAS build to reduce reliance on Expo Go LAN behavior.

## Current Git State Notes

Important recent event:

- Local uncommitted WIP was stashed before switching back to main.
- Stash message: `local WIP before testing contextual Patricia home note`

That stash included local work around:

- Backend template.
- Milestones handler.
- Child/profile sync.
- Settings API/UI.
- Local package lock and JSON library files.

This stash should be reviewed before assuming all local work is on `main`.

Current branch observed after latest work:

- `codex/patricia-simultaneous-voice-text`

Latest merged main commit observed:

- `0607363 Add contextual Patricia home note entry (#27)`

## Known Product Issues To Fix

High priority:

- Make physical-device Expo testing reliable.
- Confirm latest PRs are merged and local `main` is pulled before testing.
- Restore/review the local stash so useful settings/profile/vaccine work is not lost.
- Deploy backend after backend changes, especially chat/vaccine/profile changes.
- Fix or verify 502 errors in mobile vaccine/profile sync endpoints.
- Make Patricia responses stop falling into inappropriate emergency language for ordinary questions.
- Add “Discuss with Patricia” visibly to the end of the Home note card.
- Ensure “Talk to Patricia” resumes the last conversation when it exists.
- If first chat ever, Patricia should greet: “Hello [first name], what’s on your mind? I’m here to help. How is [child name]?”

Medium priority:

- Finish full B1-B7 onboarding exactly per latest design brief.
- Ensure every screen has obvious navigation out.
- Improve chat input keyboard avoidance everywhere.
- Finish photo upload/select during onboarding.
- Tighten voice tray UI sizing.
- Add password validation and account switching/session cleanup.
- Make onboarding Patricia intro automatically play, but without assuming the parent name before it is collected.

Lower priority:

- Polish all screens against SVG visual specs.
- Add deeper reports, weekly letters, and email delivery.
- Add full settings detail screens.
- Add production mobile app deployment path.

## Recommended Next Sequence

1. Stabilize local testing.

   Get Expo LAN or tunnel working consistently. Without reliable reloads, we keep chasing stale builds.

2. Clean git state.

   Review the stash, decide what to keep, apply carefully, and either commit/PR or discard intentionally.

3. Verify latest Home note Patricia entry.

   Confirm that the Home note card shows “Discuss with Patricia” and that it routes to chat with the daily note context.

4. Deploy backend.

   Deploy `Backend/infra/template.yaml` from the correct directory:

   ```powershell
   cd C:\Users\eja\Nianza\Backend
   sam deploy --profile nianza-prod --region us-east-2 --stack-name nianza-backend-prod --template-file infra\template.yaml --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=prod AdminEmail=eja+nianza@banxito.com InitialAdminRole=super_admin DeepgramApiKey="$env:DEEPGRAM_API_KEY" DeepgramTtsModel=aura-2-cordelia-en DeepgramSttModel=nova-2 --resolve-s3
   ```

5. Test with a fresh mobile session.

   Sign out/sign in after backend changes so Cognito tokens and profile state are fresh.

6. Make Patricia memory real.

   Persist conversation state server-side so generic “Talk to Patricia” resumes the last meaningful conversation.

7. Complete one vertical slice end-to-end.

   Recommended slice: Home note -> Discuss with Patricia -> context-aware chat reply -> Patricia voice replay -> back to Home.

## Definition Of Done For The Next Slice

The next slice should be considered done when:

- Home note shows “Discuss with Patricia”.
- Tapping it opens chat.
- Patricia starts with a warm message that references the actual note and child.
- The user asks a follow-up.
- Patricia answers based on the note context without saying “you are on the Home screen”.
- Voice plays with the same Patricia voice.
- Back navigation returns to Home.
- Generic “Talk to Patricia” resumes the last chat, or starts first-time greeting if there is no memory.
- GitHub checks are green.
- PR is merged.
- Local `main` is pulled.
