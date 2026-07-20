# Admin Auth And Deployment Wiring

This slice wires the admin portal to a real Cognito-backed admin identity provider and protects the admin API with an API Gateway Cognito authorizer.

## What Gets Created

The backend SAM stack creates:

- `AdminUserPool`: separate Cognito user pool for Nianza admin users.
- `AdminUserPoolClient`: app client for the web admin portal.
- `InitialAdminUser`: `eja+nianza@banxito.com` with `custom:role=super_admin`.
- `AdminApi`: REST API protected by the Cognito authorizer.
- DynamoDB admin/content tables from the previous slice.

The initial admin user receives a Cognito invite email with a temporary password. On first portal sign-in, Cognito requires a permanent password.

## Deploy Backend

From `C:\Users\eja\Nianza\Backend`:

```powershell
sam deploy --profile nianza-prod --config-env prod
```

For first-time deployment, use guided mode:

```powershell
sam deploy --guided --profile nianza-prod
```

Recommended values:

- Stack Name: `nianza-backend-prod`
- AWS Region: `us-east-2`
- Parameter `Environment`: `prod`
- Parameter `AdminEmail`: `eja+nianza@banxito.com`
- Parameter `InitialAdminRole`: `super_admin`
- Allow SAM to create IAM roles: `Y`

## Capture Outputs

After deployment:

```powershell
aws cloudformation describe-stacks `
  --profile nianza-prod `
  --region us-east-2 `
  --stack-name nianza-backend-prod `
  --query "Stacks[0].Outputs" `
  --output table
```

Copy these output values into `AdminPortal\.env`:

```env
VITE_ADMIN_API_URL=<AdminApiUrl>
VITE_ADMIN_COGNITO_REGION=us-east-2
VITE_ADMIN_COGNITO_USER_POOL_ID=<AdminUserPoolId>
VITE_ADMIN_COGNITO_CLIENT_ID=<AdminUserPoolClientId>
```

## Verify Admin Flow

1. Open the admin portal.
2. Sign in as `eja+nianza@banxito.com` using the temporary password from the Cognito invite email.
3. Set a permanent password when prompted.
4. Create draft content.
5. Submit clinical review.
6. Approve the content for users.
7. Confirm DynamoDB has the content row and corresponding audit log rows.

## Role Model

- `super_admin`: create, clinically review, and approve content.
- `content_editor`: create and clinically review content.
- `operations`: read-only access for this slice.
