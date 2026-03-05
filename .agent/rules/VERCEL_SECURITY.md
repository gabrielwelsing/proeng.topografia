# Vercel Deployment Protection Gotcha

> **Lesson Learned:** Vercel "Standard Protection" (Vercel Authentication) blocks public access even if your app has its own login system.

## The Issue
When visiting a project URL (e.g., `project.vercel.app`), visitors are redirected to `vercel.com/login` and asked to join the team. This happens because Vercel injects its own SSO/Auth layer *before* the application loads.

## The Symptoms
- Users reported being asked to create a Vercel account.
- Redirect URLs containing `vercel.com/login?next=...sso-api`.
- Application login page never loads for unauthenticated Vercel users.

## The Resolution
1. Go to **Project Settings** → **Deployment Protection**.
2. Find **Vercel Authentication** (Hobby) or **Standard Protection** (Pro).
3. Set it to **Disabled**.
4. Click **Save**.

## Future Prevention
For any public SaaS or portal:
- **ALWAYS** check that Deployment Protection is disabled for the Production environment.
- This is especially critical even on Hobby plans where Vercel might default to "Protected" for some configurations.
