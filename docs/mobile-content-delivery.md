# Mobile Content Delivery

This slice exposes approved Patricia content to the mobile app without exposing admin workflow routes or draft material.

## Backend

The SAM stack creates a public read-only mobile API:

```text
GET /mobile/v1/content/daily-note?language=en&ageWindowMonths=4&domain=movement
```

The Lambda only returns content that is:

- clinically reviewed
- Ej-approved
- not deleted

If no approved match exists, the API returns:

```json
{ "item": null }
```

## Mobile App

The Home screen fetches the approved daily note with React Query. If the API is unavailable or no approved content exists, the app keeps showing Patricia's saved local note.

After deployment, copy the CloudFormation `MobileApiUrl` output into `MobileApp\.env`:

```env
EXPO_PUBLIC_API_URL=<MobileApiUrl>
```

Restart the Expo dev server after changing `.env`.
