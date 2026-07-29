# Nianza — Admin Portal Engineering Brief
### NZA-ADMIN-v1.0 (As-Built) · July 17, 2026

---

The Average Tech Company LLC — Cowork Engineering Brief

**Nianza**

Admin Portal — Engineering Brief v1.0 · NZA-ADMIN-v1.0

|                      |                                                                                                                                                                                                                                                                  |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Brief version**    | NZA-ADMIN-v1.0                                                                                                                                                                                                                                                   |
| **Source documents** | NZA-ENG-v1.4 (app backend), NZA-PDD-v1.7 (product decisions). This brief extends v1.4 — it does not replace it. Both are required for implementation.                                                                                                            |
| **AWS accounts**     | nianza-prod (672061768724) — all admin Lambdas, DynamoDB tables, Cognito admin pool; Banxito (869935087622) — SES/email; claricito-prod (839001574339) — reference only                                                                                          |
| **Admin URL**        | admin.nianza.com — hosted on CloudFront + S3; DNS managed on GoDaddy                                                                                                                                                                                             |
| **Tech stack**       | React (Vite) SPA hosted on CloudFront/S3; API Gateway + Lambda (Node.js 20.x); AWS Cognito (separate admin pool, MFA required); DynamoDB (new nianza-admin-\* tables + read access to existing nianza-\* tables)                                                 |
| **Reviewer / gate**  | Ej (eja@banxito.com) — required sign-off before any admin portal user is provisioned and before any feature that writes to production app data is deployed                                                                                                       |
| **Date**             | July 17, 2026                                                                                                                                                                                                                                                    |
| **Cowork note**      | Build the admin portal backend first (Phases 1–3) before starting the frontend (Phases 4–5). The admin portal never writes directly to app tables — all writes go through the same Lambdas the app uses. Never expose raw DynamoDB access from the admin portal. |

**⚠ The admin portal has read access to child health records, parent wellbeing conversations, and subscription data. Every admin action is audit-logged. Admin credentials are MFA-protected. Never grant console-level AWS access through the portal.**

## 1. Overview & Purpose

The Nianza admin portal (admin.nianza.com) is an internal web application for The Average Tech Company LLC staff. It provides operational control over the Nianza app, the content that powers Patricia's voice, the subscription and user base, and the business metrics that inform product decisions. It does not replace AWS Console access — it surfaces the operational layer above infrastructure.

The portal is built first because: (1) the content library must be populated and approved through the portal before any app features can serve users; (2) SSM flags for TTS voice approval and content approval are set through the portal; and (3) subscription and user operations must be accessible to Ej before the app goes live.

### 1.1 Admin roles

| **Role**       | **Who**                          | **Access level**                                                                                                                                                 |
|----------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| super_admin    | Ej only                          | Full read/write across all portal sections. Only role that can approve content (set ejApproved=true), flip SSM flags, manage admin users, and access audit logs. |
| content_editor | Content team / clinical reviewer | Read/write access to content library only. Cannot approve content — submits for Ej approval. Cannot access user data, subscription data, or SSM controls.        |
| operations     | Future ops staff                 | Read access to user/subscription data, metrics dashboard, notification logs. Cannot approve content or flip SSM flags. Cannot read conversation content.         |

ℹ Start with super_admin only. content_editor and operations roles are provisioned when staff are hired. The portal must enforce these boundaries at the Lambda level, not just the UI level.

## 2. Architecture

### 2.1 Hosting — admin.nianza.com

| **Layer** | **Technology**                  | **Notes**                                                                                                                                                                                                                                                                                                                           |
|-----------|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Frontend  | React (Vite) SPA                | Built as static assets. Deployed to S3 bucket nianza-admin-portal-prod. Served via CloudFront distribution. Custom domain admin.nianza.com via GoDaddy DNS CNAME → CloudFront. ACM certificate in us-east-1 (required for CloudFront).                                                                                              |
| Auth      | AWS Cognito — nianza-admin-pool | Separate pool from the app user pool (nianza-user-pool). MFA required for all admin users (TOTP). No self-registration — admin users are provisioned by Ej only via the portal's user management screen or Cognito console. Hosted UI not used — custom React login form.                                                           |
| API       | API Gateway (REST) + Lambda     | Separate API Gateway from the app API. Base path: /admin/v1/. All routes require the Cognito admin JWT authorizer. All routes return 403 for any JWT from nianza-user-pool (app users cannot call admin API even with a valid token).                                                                                               |
| Database  | DynamoDB                        | New tables: nianza-admin-audit-log, nianza-admin-sessions. Read access to existing nianza-\* tables via IAM role on admin Lambdas. Writes to app data go through existing nianza-\* Lambdas — never direct DynamoDB puts from admin Lambdas to app tables, except nianza-content-library (content management is an admin function). |
| SSM       | SSM Parameter Store             | Admin Lambdas have read/write access to /nianza/\* parameters (for flipping AI model, TTS approval flags, feature flags). Write actions are audit-logged.                                                                                                                                                                           |
| CDN       | CloudFront                      | OAC-protected S3 origin. Cache-Control: no-cache for index.html so deploys take effect immediately. Static assets cached with content-hash filenames.                                                                                                                                                                               |

### 2.2 Admin Cognito pool — nianza-admin-pool

|                          |                                                                                                                                                       |
|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Pool name**            | nianza-admin-pool                                                                                                                                     |
| **MFA**                  | Required — TOTP (Google Authenticator / Authy). SMS MFA not used.                                                                                     |
| **Password policy**      | Min 12 chars, mixed case, numbers, symbols. 90-day rotation required.                                                                                 |
| **User creation**        | Admin only — no self-registration. Ej provisions users via Cognito console or the portal's user management screen.                                    |
| **JWT claims**           | role (super_admin \| content_editor \| operations) stored as Cognito custom attribute. Admin Lambda authorizer validates this claim on every request. |
| **Session**              | Access token TTL: 1 hour. Refresh token TTL: 7 days. Inactive session terminates after 30 minutes.                                                    |
| **App users locked out** | JWT from nianza-user-pool is rejected at the admin API Gateway authorizer. A parent cannot call admin endpoints with their app account.               |

### 2.3 DNS — GoDaddy

After ACM certificate is issued and CloudFront distribution is created: add a CNAME record in GoDaddy DNS for admin.nianza.com pointing to the CloudFront distribution domain. The certificate must be validated via DNS validation (CNAME record added to GoDaddy). All HTTP traffic redirected to HTTPS at the CloudFront level.

## 3. New DynamoDB Tables (Admin)

Two new tables in nianza-prod (672061768724). The admin portal reads from existing nianza-\* app tables via IAM but does not own them — schema changes to app tables remain governed by NZA-ENG-v1.4.

**nianza-admin-audit-log**

|                |                                                                                                                                                                                                                                                                                                                                                                                     |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **PK**         | adminUserId (String — Cognito sub of the admin)                                                                                                                                                                                                                                                                                                                                     |
| **SK**         | timestamp#actionId (String — ISO + uuid)                                                                                                                                                                                                                                                                                                                                            |
| **Attributes** | actionId, adminUserId, adminEmail, adminRole, action (String — e.g. content.approve, ssm.write, user.disable, content.create), targetId (String — contentId, userId, ssmParam, etc.), targetType (String), previousValue (String \| null — for SSM changes), newValue (String \| null), ipAddress, userAgent, result (success \| failure), errorMessage (String \| null), createdAt |
| **GSI**        | GSI1: action (PK) + timestamp (SK) — for filtering audit log by action type                                                                                                                                                                                                                                                                                                         |
| **TTL**        | None — audit log is permanent. Never auto-expire.                                                                                                                                                                                                                                                                                                                                   |
| **Notes**      | Every admin action that writes, approves, or modifies data must write a row here. Read-only queries (dashboard views, list views) are not logged. The audit log is readable only by super_admin. It is never deletable through the portal — only through direct AWS console access by Ej.                                                                                           |

**nianza-admin-sessions**

|                |                                                                                                                        |
|----------------|------------------------------------------------------------------------------------------------------------------------|
| **PK**         | adminUserId (String)                                                                                                   |
| **SK**         | sessionId (String — uuid)                                                                                              |
| **Attributes** | sessionId, adminUserId, adminEmail, loginAt, lastActiveAt, ipAddress, userAgent, isActive (boolean)                    |
| **TTL**        | expiresAt — 7 days (matches Cognito refresh token TTL)                                                                 |
| **Notes**      | Tracks active admin sessions. Used for the active sessions view in user management and for forced session termination. |

## 4. Admin Lambda Functions

All admin Lambdas in nianza-prod (672061768724), Node.js 20.x, us-east-1. Naming convention: nianza-admin-{function}-lambda. Separate execution roles from app Lambdas — admin roles have read access to app tables and read/write to admin tables and SSM. All admin Lambdas validate the JWT role claim before executing any logic.

**⚠ No admin Lambda may write directly to nianza-users, nianza-children, nianza-vitals-log, nianza-conversations, nianza-milestone-progress, or nianza-immunization-status. Those writes go through the app Lambdas. The only exception is nianza-content-library — content management is an admin function.**

### 4.1 Content Library Management

The content library (nianza-content-library) is the only app table that admin Lambdas write to directly. All other app data is read-only from the admin perspective.

**nianza-admin-content-list-lambda · GET /admin/v1/content**

|             |                                                                                                                                                                                      |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Lists content items from nianza-content-library with filtering and pagination. Supports filtering by contentType, language, ageWindowMonths, domain, clinicallyReviewed, ejApproved. |
| **Inputs**  | queryParams: contentType, language, ageWindow, domain, clinicallyReviewed (boolean), ejApproved (boolean), limit (default 50), lastEvaluatedKey                                      |
| **Outputs** | { items: ContentItem\[\], count: number, lastEvaluatedKey: string \| null }                                                                                                          |
| **Notes**   | Read-only. No audit log entry required. Returns all fields including review status — admin needs to see unapproved content.                                                          |

**nianza-admin-content-create-lambda · POST /admin/v1/content**

|             |                                                                                                                                                                                                                                                            |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Creates a new content item in nianza-content-library. New items are created with clinicallyReviewed=false and ejApproved=false by default — they are never served to app users until both flags are true.                                                  |
| **Inputs**  | contentType, language, ageWindowMonths (optional), domain (optional), bodyText, ttsEnabled (boolean), sourceRef                                                                                                                                            |
| **Outputs** | Created content item with contentId and version; audit log row written                                                                                                                                                                                     |
| **Notes**   | contentId format: {contentType}#{language}#{ageWindowMonths \|\| 'global'}#{domain \|\| 'none'}#{uuid4 last 6 chars}. version: '1.0.0'. clinicallyReviewed and ejApproved default to false — never set true at creation. Audit log action: content.create. |

**nianza-admin-content-update-lambda · PUT /admin/v1/content/{contentId}**

|             |                                                                                                                                                                                                                                                         |
|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Updates the bodyText, ttsEnabled, or sourceRef of an existing content item. Creates a new version rather than overwriting — content is versioned. The old version remains queryable but is superseded.                                                  |
| **Inputs**  | contentId, bodyText (optional), ttsEnabled (optional), sourceRef (optional). Cannot update contentType, language, ageWindowMonths, domain — those are structural and would require a new contentId.                                                     |
| **Outputs** | Updated content item at new semver; old version preserved; audit log row                                                                                                                                                                                |
| **Notes**   | Version increment: patch for minor text edits, minor for structural changes (caller specifies). After update, clinicallyReviewed and ejApproved are reset to false on the new version — an update requires re-review. Audit log action: content.update. |

**nianza-admin-content-review-lambda · POST /admin/v1/content/{contentId}/review**

|             |                                                                                                                                                                     |
|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Sets clinicallyReviewed=true on a content item. Available to content_editor and super_admin roles. Clinical review sign-off — separate from Ej approval.            |
| **Inputs**  | contentId, version, reviewerNote (optional)                                                                                                                         |
| **Outputs** | Updated item; audit log row                                                                                                                                         |
| **Notes**   | Cannot set ejApproved — that is super_admin only. Audit log action: content.clinical-review. If clinicallyReviewed is already true, return 409 — do not double-log. |

**nianza-admin-content-approve-lambda · POST /admin/v1/content/{contentId}/approve**

|             |                                                                                                                                                                                                                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Sets ejApproved=true on a content item. SUPER_ADMIN ONLY. This is the gate that allows content to be served to app users. Will return 403 if the caller is not super_admin. Will return 400 if clinicallyReviewed is not already true — clinical review must precede Ej approval. |
| **Inputs**  | contentId, version                                                                                                                                                                                                                                                                |
| **Outputs** | Updated item with ejApproved=true; audit log row                                                                                                                                                                                                                                  |
| **Notes**   | Guard: if clinicallyReviewed=false, return 400 with error 'Clinical review required before Ej approval.' Audit log action: content.approve. This is the most consequential write in the admin portal — log it prominently.                                                        |

**nianza-admin-content-delete-lambda · DELETE /admin/v1/content/{contentId}**

|             |                                                                                                                                                                                             |
|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Soft-deletes a content item by setting deleted=true. Does not physically remove from DynamoDB. SUPER_ADMIN ONLY.                                                                            |
| **Inputs**  | contentId, version, reason (required — must state why item is being removed)                                                                                                                |
| **Outputs** | Item marked deleted; audit log row                                                                                                                                                          |
| **Notes**   | Items with deleted=true are excluded from all app Lambda queries automatically (add filter condition). Audit log action: content.delete. Reason is stored in the audit log and on the item. |

### 4.2 SSM Parameters & Feature Flags

The portal provides a controlled interface to the SSM parameters that govern app behavior. All SSM writes are audit-logged. SUPER_ADMIN ONLY.

**nianza-admin-ssm-list-lambda · GET /admin/v1/ssm**

|             |                                                                                                                        |
|-------------|------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Lists all /nianza/\* SSM parameters and their current values. Secrets (API keys) are masked — shows last 4 chars only. |
| **Inputs**  | None                                                                                                                   |
| **Outputs** | { parameters: \[ { name, value (masked for secrets), type, lastModifiedAt } \] }                                       |
| **Notes**   | Read-only. Masks any parameter containing 'key', 'secret', or 'password' in its name. No audit log for reads.          |

**nianza-admin-ssm-write-lambda · PUT /admin/v1/ssm/{paramName}**

|             |                                                                                                                                                                                                                                                                                                                                                                                                             |
|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Updates a single SSM parameter. SUPER_ADMIN ONLY. The most common use cases: flipping /nianza/ai-vendor, updating /nianza/ai-model, setting /nianza/tts-approved/{language}.                                                                                                                                                                                                                                |
| **Inputs**  | paramName (path), value (body), reason (body — required, explains why the change is being made)                                                                                                                                                                                                                                                                                                             |
| **Outputs** | Updated parameter confirmation; audit log row with previousValue and newValue                                                                                                                                                                                                                                                                                                                               |
| **Notes**   | paramName must start with /nianza/. Refuses writes to any parameter outside this namespace. Audit log action: ssm.write. previousValue captured before write. reason stored in audit log. For TTS approval flags (/nianza/tts-approved/\*), the UI presents a confirmation dialog: 'Setting this flag will allow Patricia to speak in \[language\] on real devices. Confirm.' before calling this endpoint. |

### 4.3 App User Management

Read-only view of app users and subscription status. No writes to user data — all mutations go through app Lambdas or RevenueCat. SUPER_ADMIN and OPERATIONS roles.

**nianza-admin-users-list-lambda · GET /admin/v1/users**

|             |                                                                                                                                                                                                                |
|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Lists app users from nianza-users with filtering by subscriptionStatus, language, trialEndsAt range. Paginated.                                                                                                |
| **Inputs**  | queryParams: subscriptionStatus, language, trialEndsBefore, trialEndsAfter, limit (default 25), lastEvaluatedKey                                                                                               |
| **Outputs** | { users: UserSummary\[\], count, lastEvaluatedKey }                                                                                                                                                            |
| **Notes**   | UserSummary: userId, email, firstName, language, subscriptionStatus, trialStartedAt, trialEndsAt, createdAt, childCount (computed). Never returns pushToken, conversationSummary, or any conversation content. |

**nianza-admin-users-get-lambda · GET /admin/v1/users/{userId}**

|             |                                                                                                                                                                                                                    |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Returns full profile for a single app user including children (names and ages only, not records), subscription status, and notification log summary.                                                               |
| **Inputs**  | userId (path)                                                                                                                                                                                                      |
| **Outputs** | { user: UserDetail, children: ChildSummary\[\], subscriptionStatus, notificationLog: last 10 entries }                                                                                                             |
| **Notes**   | Never returns vitals log, milestone progress detail, or conversation content. ChildSummary: childId, firstName, correctedAgeMonths, dateOfBirth. This is an operational view for support, not a surveillance tool. |

**nianza-admin-users-disable-lambda · POST /admin/v1/users/{userId}/disable**

|             |                                                                                                                                                                                      |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Disables an app user account (sets Cognito account status to DISABLED). Used for abuse, fraud, or legal hold. SUPER_ADMIN ONLY.                                                      |
| **Inputs**  | userId (path), reason (body — required)                                                                                                                                              |
| **Outputs** | Cognito user disabled; audit log row                                                                                                                                                 |
| **Notes**   | Does not delete data. Does not cancel subscription (that must be done separately in RevenueCat). Audit log action: user.disable. Ej must confirm in the UI before this action fires. |

**nianza-admin-users-delete-initiate-lambda · POST /admin/v1/users/{userId}/delete**

|             |                                                                                                                                                                                                                                    |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Initiates full account deletion for an app user (invokes the existing nianza-account-deletion-lambda). Used for GDPR/COPPA deletion requests. SUPER_ADMIN ONLY.                                                                    |
| **Inputs**  | userId (path), reason (body — required), legalBasis (body — e.g. 'COPPA request', 'user request via email')                                                                                                                        |
| **Outputs** | Deletion initiated; audit log row with legalBasis recorded                                                                                                                                                                         |
| **Notes**   | This invokes nianza-account-deletion-lambda which handles all data deletion across tables and S3. The admin portal does not delete data directly. Audit log action: user.deletion-initiated. Two-step confirmation required in UI. |

### 4.4 Subscription Management

**nianza-admin-subscriptions-list-lambda · GET /admin/v1/subscriptions**

|             |                                                                                                                                                                               |
|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Lists subscription status across users. Reads from nianza-users (subscriptionStatus GSI). Supports filtering and basic cohort analysis.                                       |
| **Inputs**  | queryParams: status (trialing\|active\|expired\|cancelled), language, limit                                                                                                   |
| **Outputs** | { subscriptions: SubscriptionSummary\[\], totals: { trialing, active, expired, cancelled } }                                                                                  |
| **Notes**   | Read-only. No RevenueCat direct API call from this Lambda — RevenueCat webhooks keep nianza-users.subscriptionStatus current. This Lambda reads nianza-users, not RevenueCat. |

**nianza-admin-subscriptions-extend-trial-lambda · POST /admin/v1/subscriptions/{userId}/extend-trial**

|             |                                                                                                                                                                                           |
|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Extends a user's trial period by updating trialEndsAt in nianza-users. SUPER_ADMIN ONLY. Used for support cases (e.g., user had technical issues during trial).                           |
| **Inputs**  | userId (path), extensionDays (body, max 14), reason (body — required)                                                                                                                     |
| **Outputs** | Updated trialEndsAt; audit log row                                                                                                                                                        |
| **Notes**   | Cannot extend a trial that has already expired. Cannot extend past 30 days total from original trialStartedAt. Audit log action: subscription.trial-extended. Reason stored in audit log. |

### 4.5 Notification Log & Broadcast

**nianza-admin-notifications-log-lambda · GET /admin/v1/notifications**

|             |                                                                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Returns the notification log across users. Useful for verifying the one-per-day ceiling is working and auditing delivery cadence. |
| **Inputs**  | queryParams: userId (optional), notificationType (optional), startDate, endDate, limit                                            |
| **Outputs** | { notifications: NotificationLogEntry\[\], count }                                                                                |
| **Notes**   | Read-only. Returns entries from nianza-notification-log.                                                                          |

**nianza-admin-broadcast-lambda · POST /admin/v1/notifications/broadcast**

|             |                                                                                                                                                                                                                                                                                                                                                                          |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Sends a one-time push notification to a targeted segment of users. SUPER_ADMIN ONLY. Used for service announcements (e.g., new language available, scheduled maintenance). NOT for marketing or re-engagement.                                                                                                                                                           |
| **Inputs**  | segment (all \| language:{code} \| subscriptionStatus:{status}), title (max 60 chars), body (max 140 chars), dryRun (boolean — if true, returns target count without sending)                                                                                                                                                                                            |
| **Outputs** | { targetCount, sent, failed } — or { targetCount, dryRun: true } if dryRun                                                                                                                                                                                                                                                                                               |
| **Notes**   | Hard constraint: broadcast messages must not be promotional in nature. The UI presents a warning: 'Broadcast notifications are for service announcements only, consistent with the anti-extractive notification principle.' The dryRun flag must be used before any real send — UI enforces this. All broadcasts audit-logged. Audit log action: notification.broadcast. |

### 4.6 Metrics & Dashboard

**nianza-admin-metrics-lambda · GET /admin/v1/metrics**

|             |                                                                                                                                                                                                                                                                                         |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Returns key business and operational metrics. Data assembled from DynamoDB scans/queries on nianza-users, nianza-children, nianza-reports, nianza-notification-log, and nianza-content-library. Cached in SSM/Parameter Store at 15-minute intervals to avoid repeated expensive scans. |
| **Inputs**  | queryParams: period (today \| week \| month \| all)                                                                                                                                                                                                                                     |
| **Outputs** | { users: { total, trialing, active, expired, cancelled, newThisPeriod }, children: { total, avgPerUser }, content: { total, approved, pendingReview }, notifications: { sentThisPeriod, deliveryRate }, reports: { generatedThisPeriod } }                                              |
| **Notes**   | This Lambda never reads conversation content, vitals, or milestone detail — only aggregate counts. Cache key: /nianza/admin/metrics-cache/{period}. Cache TTL: 15 minutes. If cache is fresh, return cached value without scanning DynamoDB.                                            |

### 4.7 Admin User Management (Portal Users)

**nianza-admin-portal-users-list-lambda · GET /admin/v1/portal-users**

|             |                                                                                                |
|-------------|------------------------------------------------------------------------------------------------|
| **Purpose** | Lists all admin portal users (Cognito admin pool users). SUPER_ADMIN ONLY.                     |
| **Inputs**  | None                                                                                           |
| **Outputs** | { users: \[ { userId, email, role, status, createdAt, lastLoginAt } \] }                       |
| **Notes**   | Reads from Cognito admin pool and cross-references with nianza-admin-sessions for lastLoginAt. |

**nianza-admin-portal-users-create-lambda · POST /admin/v1/portal-users**

|             |                                                                                                                                                           |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose** | Creates a new admin portal user in nianza-admin-pool. SUPER_ADMIN ONLY. Triggers a Cognito temporary password email.                                      |
| **Inputs**  | email, role (content_editor \| operations), firstName                                                                                                     |
| **Outputs** | Created user; temporary password email sent; audit log row                                                                                                |
| **Notes**   | Role super_admin cannot be assigned through this endpoint — only through direct Cognito console modification by Ej. Audit log action: portal-user.create. |

**nianza-admin-portal-users-disable-lambda · POST /admin/v1/portal-users/{adminUserId}/disable**

|             |                                                                                       |
|-------------|---------------------------------------------------------------------------------------|
| **Purpose** | Disables an admin portal user and terminates all active sessions. SUPER_ADMIN ONLY.   |
| **Inputs**  | adminUserId (path)                                                                    |
| **Outputs** | Cognito user disabled; active sessions terminated; audit log row                      |
| **Notes**   | Cannot disable your own account — returns 400. Audit log action: portal-user.disable. |

## 5. Frontend — admin.nianza.com

React (Vite) single-page application. No framework beyond React — no Next.js, no SSR. Deployed as static assets to S3 + CloudFront. Authentication handled via AWS Amplify Auth (or direct Cognito SDK) against nianza-admin-pool.

### 5.1 Tech stack

| **Layer**    | **Technology**             | **Notes**                                                                                                                               |
|--------------|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| Framework    | React 18 + Vite            | SPA. React Router v6 for client-side routing.                                                                                           |
| Auth         | AWS Amplify Auth (Cognito) | Configured against nianza-admin-pool. Custom login page — not Cognito Hosted UI. TOTP MFA setup flow on first login.                    |
| API calls    | Axios + React Query        | All API calls authenticated with Cognito access token in Authorization header. React Query for server state, cache, and loading states. |
| UI           | Tailwind CSS               | Utility-first. No component library — keep the portal functional and minimal. The admin portal is a tool, not a product.                |
| Tables       | TanStack Table v8          | Sortable, filterable, paginated tables for user and content lists.                                                                      |
| Charts       | Recharts                   | Metrics dashboard charts.                                                                                                               |
| Build/deploy | Vite + AWS CodePipeline    | CI/CD: push to main branch triggers CodePipeline → CodeBuild → S3 sync → CloudFront invalidation.                                       |

### 5.2 Screen inventory

All screens require authentication. Role-based access enforced at the API level and reflected in the UI (sections not accessible to a role are hidden, not just disabled).

| **Screen**          | **Route**              | **Roles**        | **Description**                                                                                                                                                                                                                        |
|---------------------|------------------------|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Login               | /login                 | All              | Email + password. TOTP MFA prompt on second step. 'First login' flow triggers password change and MFA setup.                                                                                                                           |
| Dashboard           | /                      | All              | Key metrics: total users, active subscribers, trialing, content items pending review. Quick-action buttons for most common tasks.                                                                                                      |
| Content Library     | /content               | All              | Filterable table of all content items. Columns: contentId, type, language, age window, status (draft \| reviewed \| approved). Bulk actions: approve selected (super_admin only).                                                      |
| Content Item        | /content/:contentId    | All              | Full content item detail. Edit bodyText inline (content_editor). Submit for review button (content_editor). Approve button (super_admin, only enabled when clinicallyReviewed=true). Audit history for this item.                      |
| New Content         | /content/new           | All              | Form to create new content item. contentType, language, age window, domain, bodyText, sourceRef, ttsEnabled.                                                                                                                           |
| Users               | /users                 | super_admin, ops | Paginated user list. Filter by subscription status, language. Columns: name, email, status, trial end, children count, language.                                                                                                       |
| User Detail         | /users/:userId         | super_admin, ops | User profile, children summary (name and age only), subscription status, last 10 notifications. Actions (super_admin): disable account, initiate deletion, extend trial.                                                               |
| Subscriptions       | /subscriptions         | super_admin, ops | Subscription cohort view: trialing, active, expired, cancelled counts with trend. Export CSV.                                                                                                                                          |
| Notifications       | /notifications         | super_admin, ops | Notification log viewer. Filter by type, user, date. Broadcast send form (super_admin) with dryRun preview required before send.                                                                                                       |
| SSM Parameters      | /settings/ssm          | super_admin      | Table of all /nianza/\* SSM parameters with current values (secrets masked). Edit button per row opens confirmation dialog before write.                                                                                               |
| AI & Voice Controls | /settings/ai           | super_admin      | Dedicated view for AI gateway controls: current vendor, current model, update fields. TTS approval flags per language with confirmation gate. Patricia system prompt viewer (read-only — prompt is in S3, this shows current content). |
| Audit Log           | /settings/audit        | super_admin      | Full audit log with filtering by action type, admin user, date range. Read-only. Non-deletable.                                                                                                                                        |
| Portal Users        | /settings/portal-users | super_admin      | List of admin portal accounts. Create new user. Disable user. Cannot edit super_admin accounts.                                                                                                                                        |
| Active Sessions     | /settings/sessions     | super_admin      | Active admin sessions list. Force-terminate any session.                                                                                                                                                                               |

### 5.3 Content approval workflow (UI flow)

The content workflow is the most critical operational flow in the portal. Every piece of content that Patricia speaks must pass through it before reaching users.

- Content editor creates item via /content/new → status: draft (clinicallyReviewed=false, ejApproved=false)

- Clinical reviewer opens item, reads bodyText, clicks 'Submit clinical review' → status: reviewed (clinicallyReviewed=true). A note field is optional.

- Ej (super_admin) opens item, reads bodyText and sourceRef, confirms clinical review is complete, clicks 'Approve for users' → status: approved (ejApproved=true). Cannot approve without clinicallyReviewed=true — button is disabled and shows 'Awaiting clinical review'.

- Approved content is immediately served to app users by the Lambdas that filter on ejApproved=true.

- If Ej edits the bodyText of an approved item, a new version is created and the item returns to draft status — both flags reset. The previous approved version remains active until the new version is approved.

ℹ The portal must display the content item's sourceRef prominently (e.g., 'CDC-LTSAE-2022-p7') so the reviewer can verify the clinical source before approving. This is not decorative — it is the audit trail.

### 5.4 TTS voice approval (UI flow)

Patricia's voice cannot be heard on any real device until Ej sets the TTS approval flag for that language. This flow is in the AI & Voice Controls screen.

- Screen shows each language with current TTS approval status: English (not approved), Spanish (not approved), French (not approved), Arabic (contingent on Deepgram support).

- Ej listens to voice samples (linked externally — Deepgram sample URLs or local playback).

- Ej clicks 'Approve English voice' → confirmation dialog: 'Setting this flag will allow Patricia to speak in English on real user devices. This cannot be undone without a manual SSM change. Confirm.' → On confirm, Lambda writes /nianza/tts-approved/en = 'true' to SSM. Audit log: ssm.write.

- App Lambda checks /nianza/tts-approved/{language} on every TTS call. If not set, returns text-only response — no audio.

## 6. Deployment & Infrastructure

### 6.1 S3 buckets (new)

| **Bucket name**            | **Purpose**                                  | **Access**                                                 |
|----------------------------|----------------------------------------------|------------------------------------------------------------|
| nianza-admin-portal-prod   | Static React SPA assets for admin.nianza.com | CloudFront OAC only. No public access. Versioning enabled. |
| nianza-admin-portal-builds | CodeBuild artifacts before S3 sync           | CodePipeline service role only.                            |

### 6.2 CloudFront distribution

|                      |                                                                                                                                                                   |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Origin**           | nianza-admin-portal-prod S3 bucket via OAC                                                                                                                        |
| **Custom domain**    | admin.nianza.com                                                                                                                                                  |
| **ACM certificate**  | Requested in us-east-1 (required for CloudFront). DNS validation via GoDaddy CNAME.                                                                               |
| **Cache behavior**   | index.html: Cache-Control no-cache, no-store. All other assets: Cache-Control max-age=31536000, immutable (content-hash filenames).                               |
| **Error pages**      | 404 and 403 → /index.html with 200 status (SPA routing).                                                                                                          |
| **Security headers** | Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options: DENY, Content-Security-Policy (restrict to admin API Gateway origin and Cognito domain only). |

### 6.3 CI/CD pipeline

|                  |                                                                                                                                                      |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Source**       | GitHub repository main branch (or same repo as app, admin/ subdirectory)                                                                             |
| **Pipeline**     | AWS CodePipeline: Source → Build (CodeBuild) → Deploy (S3 sync + CloudFront invalidation)                                                            |
| **Build spec**   | npm ci → npm run build → aws s3 sync dist/ s3://nianza-admin-portal-prod --delete → CloudFront invalidation on /\*                                   |
| **Environments** | Single environment (production). No staging portal — admin SSM writes are production-only. Test admin functions against a dev AWS account if needed. |

### 6.4 IAM roles

| **Role name**                  | **Attached to**   | **Permissions**                                                                                                                                                                                                                                                                                      |
|--------------------------------|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| nianza-admin-lambda-role       | All admin Lambdas | DynamoDB: Read on all nianza-\* tables. Read/write on nianza-admin-audit-log, nianza-admin-sessions, nianza-content-library. SSM: Read/write /nianza/\*. Cognito: Admin actions on nianza-admin-pool and nianza-user-pool (user disable, list users). Lambda: Invoke nianza-account-deletion-lambda. |
| nianza-admin-codebuild-role    | CodeBuild project | S3: PutObject on nianza-admin-portal-prod, nianza-admin-portal-builds. CloudFront: CreateInvalidation.                                                                                                                                                                                               |
| nianza-admin-codepipeline-role | CodePipeline      | CodeBuild: StartBuild. S3: GetObject on source artifact bucket.                                                                                                                                                                                                                                      |

## 7. Build Order

**⚠ Build the admin backend (Phases 1–3) before starting the app backend (NZA-ENG-v1.4 Phases 1–7). The content library must be populated and approved through the admin portal before any app feature can serve users.**

| **Phase**                    | **What**                                                                                                                                                                                                                                       | **Gate before proceeding**                                                                                                                                                    |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 — Admin infrastructure     | nianza-admin-pool Cognito (MFA required); nianza-admin-audit-log and nianza-admin-sessions DynamoDB tables; S3 buckets; CloudFront distribution; ACM certificate; GoDaddy DNS CNAME; IAM roles; Admin API Gateway skeleton with JWT authorizer | Ej verifies admin.nianza.com resolves; verifies Ej account can log in with MFA; verifies app user JWT is rejected at admin API                                                |
| 2 — Content management APIs  | nianza-admin-content-\* Lambdas (list, create, update, review, approve, delete); nianza-admin-ssm-\* Lambdas; audit logging on all write actions                                                                                               | Ej creates one test content item, submits for clinical review, approves it, verifies it appears in nianza-content-library with correct flags; verifies audit log entry exists |
| 3 — User & subscription APIs | nianza-admin-users-\* Lambdas; nianza-admin-subscriptions-\* Lambdas; nianza-admin-notifications-\* Lambdas; nianza-admin-metrics-lambda; nianza-admin-portal-users-\* Lambdas                                                                 | Ej verifies user list returns correct data; verifies trial extension writes to nianza-users; verifies broadcast dryRun returns correct count                                  |
| 4 — Frontend core            | React app scaffolding; login + MFA flow; Dashboard; Content Library screens (list, detail, create, approve workflow)                                                                                                                           | Ej logs in to admin.nianza.com; creates, reviews, and approves a test content item through the UI; verifies the approved item is served by the app milestone Lambda           |
| 5 — Frontend complete        | Users, Subscriptions, Notifications, SSM/AI controls, Audit log, Portal user management screens; CI/CD pipeline                                                                                                                                | Ej reviews all screens; approves TTS flag for English via UI; verifies audit log captured the SSM write; triggers a test broadcast with dryRun                                |

## 8. Risk Register

| **Risk**                                             | **Severity** | **Mitigation**                                                                                                                                                                                                                       |
|------------------------------------------------------|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Admin Lambda writes directly to app user data tables | Critical     | IAM policy denies PutItem/UpdateItem/DeleteItem on nianza-users, nianza-children, nianza-vitals-log, nianza-conversations, nianza-milestone-progress, nianza-immunization-status from admin Lambda execution role. Code review gate. |
| Content approved without clinical review             | Critical     | nianza-admin-content-approve-lambda returns 400 if clinicallyReviewed=false. UI disables Approve button with tooltip 'Awaiting clinical review'. Two independent guards.                                                             |
| Admin portal accessible to app users                 | High         | Admin API Gateway JWT authorizer validates iss claim against nianza-admin-pool issuer. Any token from nianza-user-pool is rejected. Tested in Phase 1 gate.                                                                          |
| SSM write without audit trail                        | High         | nianza-admin-ssm-write-lambda writes audit log row before making SSM change. If audit log write fails, the SSM change is aborted.                                                                                                    |
| TTS approval set without voice review                | High         | UI requires explicit confirmation dialog. Audit log captures the action with timestamp. The flag itself is reversible — Ej can set it back to false via SSM controls.                                                                |
| Broadcast sends promotional content                  | Medium       | UI shows warning. Broadcast body limited to 140 chars. dryRun required before real send. Audit log captures full message body. No automated triggers — manual only.                                                                  |
| Admin account compromise                             | High         | MFA required. Session TTL 30 minutes inactive. Force-terminate sessions available. No password reset without email + MFA. All admin actions audit-logged with IP.                                                                    |
| Content library grows stale (CDC/AAP revision)       | Medium       | contentVersion field on all content items. Metrics dashboard shows oldest content by sourceRef date. Admin portal surfaces content items with sourceRef older than 24 months as 'review recommended'.                                |

## 9. Handoff Checklist

Complete before handing any phase to Ej for review.

**Infrastructure**

- nianza-admin-pool created with MFA=required (TOTP), no self-registration

- nianza-admin-audit-log and nianza-admin-sessions tables created with correct schemas

- S3 bucket nianza-admin-portal-prod created with versioning enabled, no public access

- CloudFront distribution created with OAC, custom domain admin.nianza.com, error pages → index.html

- ACM certificate issued and validated via GoDaddy DNS CNAME

- GoDaddy CNAME: admin.nianza.com → CloudFront distribution domain

- nianza-admin-lambda-role IAM: confirmed no PutItem/UpdateItem/DeleteItem on app user data tables

**Security**

- Admin API JWT authorizer: test that nianza-user-pool JWT returns 403

- Admin API JWT authorizer: test that nianza-admin-pool JWT without role claim returns 403

- Content approval gate: test that approve endpoint returns 400 when clinicallyReviewed=false

- SSM write: verify audit log row is written before SSM change; verify abort if audit log fails

- Broadcast: verify dryRun=true returns count without sending; verify dryRun=false with segment 'all' writes audit log

**Ej approval gates (do not proceed without these)**

- Ej has logged in to admin.nianza.com with MFA

- Ej has created, reviewed, and approved one content item through the UI end-to-end

- Ej has verified the approved item is returned by the app milestone Lambda with ejApproved=true

- Ej has reviewed the audit log and confirmed all actions are recorded correctly

- Ej has approved TTS flag for English via the AI & Voice Controls screen

- Ej has reviewed the SSM parameter list and confirmed all /nianza/\* parameters are visible
