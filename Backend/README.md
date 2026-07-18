# Nianza Backend

AWS serverless backend for the Nianza mobile app and admin portal.

The intended implementation follows the Nianza engineering briefs:

- REST API Gateway + Lambda, Node.js 20.x
- Cognito app user pool and separate admin user pool
- DynamoDB tables for users, children, content, milestones, vaccines, vitals, reports, notifications, admin audit logs, and admin sessions
- S3 for reports, content assets, and photos
- SSM for feature flags, AI model settings, and TTS approval flags

## Build Order

1. Admin infrastructure and content approval APIs
2. App infrastructure and authenticated child/home vertical slice
3. Reports, reminders, subscriptions, and chat services
