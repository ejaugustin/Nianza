# Admin Content Approval Slice

This slice creates the first usable admin workflow for Patricia content:

1. Admin users create draft content in the admin portal.
2. A content editor or super admin marks the content as clinically reviewed.
3. A super admin approves clinically reviewed content for user delivery.
4. Each write action is recorded in the permanent admin audit log.

## Backend

The SAM template adds an `AdminApi` and `AdminContentFunction` with these routes:

- `GET /admin/v1/content`
- `POST /admin/v1/content`
- `POST /admin/v1/content/{contentId}/review`
- `POST /admin/v1/content/{contentId}/approve`

Content is stored in `nianza-content-library-${Environment}`. Audit records are written to `nianza-admin-audit-log-${Environment}` with actor, action, target, previous value, new value, IP address, and user agent details.

The Lambda expects authenticated admin claims and enforces these application roles:

- `content_editor`: create drafts and mark clinical review complete.
- `super_admin`: create drafts, mark clinical review complete, and approve content for users.
- `operations`: read-only for this slice.

## Admin Portal

The content library page now supports:

- listing content items
- creating a draft item
- selecting an item for review
- submitting clinical review
- approving reviewed content

When `VITE_ADMIN_API_URL` is not configured in local development, the portal uses a local mock item so the UI can be exercised before deployment.

## Deployment Note

The Lambda rejects missing or invalid admin identity claims, but the API Gateway authorizer still needs to be wired to the final admin identity provider before production use. This should be completed once the admin authentication stack is finalized.
