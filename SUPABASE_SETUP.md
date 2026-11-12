# InvoicePro AI — Supabase & Google Authentication Setup Guide

This project uses **Supabase Authentication** with **Google OAuth** as the exclusive authentication provider and **Supabase PostgreSQL** with **Row Level Security (RLS)** for enterprise data isolation.

Follow these steps to configure and run the authentication flow.

---

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **Anon / Public Key** from **Project Settings → API**.

---

### Step 2: Enable Google Provider in Supabase
1. In the Supabase Dashboard, navigate to **Authentication → Providers**.
2. Select **Google** and switch the toggle to **Enabled**.
3. Copy the **Callback URL (for OAuth)** shown in the Supabase dashboard. It follows the format:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

---

### Step 3: Configure Google Cloud OAuth Credentials
1. Go to the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create or select your Google Cloud project.
3. Configure the **OAuth Consent Screen** (User Type: External, Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`).
4. Navigate to **Credentials → Create Credentials → OAuth Client ID**.
5. Application Type: **Web Application**.
6. Under **Authorized redirect URIs**, add the Supabase Callback URL copied in Step 2:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
7. Click **Create** and copy your **Client ID** and **Client Secret**.

---

### Step 4: Add Google Credentials to Supabase
1. Return to **Supabase Dashboard → Authentication → Providers → Google**.
2. Paste the **Client ID** and **Client Secret** obtained from Google Cloud.
3. Click **Save**.

---

### Step 5: Configure Application Redirect URLs in Supabase
1. In Supabase Dashboard, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your application's domain URL:
   - For local development: `http://localhost:3000`
   - For Cloud Run preview: `https://<your-app-id>.run.app`
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/**`
   - `https://*.run.app/**` (or your specific Cloud Run deployment URL)
4. Click **Save**.

---

### Step 6: Configure Environment Variables
Set the following environment variables in your environment or `.env` file:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...<your-anon-key>

# Server-Side Privileged Allowlist (Cloudflare Pages Environment or backend .env)
SUPER_ADMIN_EMAIL_ALLOWLIST=admin@invoicepro360.com,raj.asusrog@gmail.com
```

> **Security Note**: Never expose the Supabase `service_role` secret or Google Client Secret in frontend code. Only the public `anon` key is used in the browser client.

---

### Step 7: Run the Database Migrations & Schema

In the Supabase Dashboard, open the **SQL Editor** and run the scripts in order:

1. **`supabase/schema.sql`** (or `supabase/migrations/20261015000000_subscription_plans_and_quotas.sql`):
   - Sets up `profiles`, `invoices`, `subscription_plans`, `subscriptions`, and `usage_history`.
   - Creates concurrency-safe PostgreSQL stored procedures:
     - `check_and_increment_ai_quota(user_uuid)`
     - `refund_ai_quota(user_uuid)`
     - `check_and_increment_invoice_quota(user_uuid)`
   - Enables RLS on all user tables.

2. **`supabase/migrations/20261015010000_super_admin_and_ai_security.sql`**:
   - Extends profiles with `is_suspended`, `suspended_at`, `suspended_reason`, and `last_seen_at`.
   - Creates `admin_roles` (super_admin, security_auditor, support_admin).
   - Creates append-only `admin_audit_logs` (tamper-resistant with no UPDATE or DELETE privileges).
   - Creates `security_alerts` queue for automated abuse threat management.
   - Creates `ai_request_logs` for privacy-minimized telemetry (PII scrubbed).
   - Creates `admin_security_config` for threshold and rate limiting policies.

---

### Step 8: Super Admin Console Access

1. Add your administrator email to the `SUPER_ADMIN_EMAIL_ALLOWLIST` server binding or insert a record into `public.admin_roles`:
   ```sql
   INSERT INTO public.admin_roles (user_id, email, role)
   VALUES ('<your-auth-user-id>', '<your-admin-email>', 'super_admin')
   ON CONFLICT (email) DO NOTHING;
   ```
2. Authenticate through Google OAuth.
3. Access the dedicated Super Admin Console at `/super-admin`.
4. Unauthorized users attempting to access `/super-admin` are blocked with an HTTP 403 Forbidden screen and their attempt is automatically logged to the audit trail.
