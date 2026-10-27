# Notification email setup

The dashboard sends the daily action-item digest and escalations through one
email channel: `lib/notifications/channels/email.channel.ts`. It speaks SMTP
directly via `nodemailer`, so any mailbox works, but the current guides cover
Gmail because the project has no sending domain.

Two authentication methods are supported. OAuth2 is preferred; an App Password
is kept as a fallback for mailboxes that still allow one.

| Method       | Secrets                                 | Refresh-token lifetime                                                   | Scope        |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| OAuth2       | client id, client secret, refresh token | None (published/Internal), 7 days while the consent screen is in Testing | `gmail.send` |
| App Password | one 16-character password               | Never                                                                    | Full mailbox |

## Environment variables

| Variable                      | Required     | Default                                 | Notes                                                                                                   |
| ----------------------------- | ------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SMTP_USER`                   | yes          | –                                       | Full sending address, e.g. `oppia.notifications@gmail.com`. Must be the account that authorized OAuth2. |
| `GOOGLE_OAUTH_CLIENT_ID`      | OAuth2       | –                                       | Desktop OAuth client id.                                                                                |
| `GOOGLE_OAUTH_CLIENT_SECRET`  | OAuth2       | –                                       | Desktop OAuth client secret.                                                                            |
| `GOOGLE_OAUTH_REFRESH_TOKEN`  | OAuth2       | –                                       | Output of `npm run gmail:refresh-token`.                                                                |
| `SMTP_PASS`                   | App Password | –                                       | Gmail App Password. Spaces are stripped automatically.                                                  |
| `SMTP_HOST`                   | no           | `smtp.gmail.com`                        |                                                                                                         |
| `SMTP_PORT`                   | no           | `465`                                   | `465` uses implicit TLS, `587` uses STARTTLS.                                                           |
| `ACTION_ITEMS_EMAIL_FROM`     | no           | `Oppia Community Dashboard <SMTP_USER>` | Gmail rewrites a From that is not the authenticated account.                                            |
| `ACTION_ITEMS_EMAIL_REPLY_TO` | no           | unset                                   | The copy says to respond on the dashboard, so a reply-to is optional.                                   |
| `ACTION_ITEM_EMAIL_ENABLED`   | no           | `true`                                  | Set to `false` to disable all email.                                                                    |

OAuth2 wins when both OAuth2 and an App Password are configured, so a leftover
`SMTP_PASS` does not interfere during a switch.

## Option A: Gmail OAuth2 (recommended)

Use this when Google says App Passwords are unavailable for the account.

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project.
2. Enable the **Gmail API** for that project.
3. Configure the **OAuth consent screen**:
   - **External** for a personal `@gmail.com` account.
   - **Internal** for a Google Workspace org. Internal needs no verification and
     refresh tokens do not expire.
4. Create an **OAuth client** of type **Desktop app** and copy its id and secret.
5. Mint a refresh token:

   ```bash
   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
     npm run gmail:refresh-token
   ```

   Open the printed URL, approve the `gmail.send` scope, and copy the printed
   `SMTP_USER` / `GOOGLE_OAUTH_*` values into your environment and Vercel.

6. Set `SMTP_USER` to the exact address shown as `Authorized account:`.
7. Redeploy after changing Vercel environment variables.

### The 7-day trap

While the consent screen is in **Testing**, Google expires refresh tokens after
7 days. The digest will start failing every week with `invalid_grant`. Fix it by
either:

- **Internal** user type (Workspace only), or
- publishing the app to **In production**. An unverified External app shows a
  "Google hasn't verified this app" warning and is capped at 100 users, which is
  fine for one internal sender. Publishing does not require verification for
  this use; verification only removes the warning.

Rotating the client secret or revoking access invalidates the refresh token;
re-run the script and update the env var.

## Option B: Gmail App Password

Use this only if `https://myaccount.google.com/apppasswords` works for the
account. That requires 2-Step Verification, no Advanced Protection, and a
Workspace admin who has not disabled App Passwords.

```bash
SMTP_USER=oppia.notifications@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
```

## Verifying a send

1. Run `npm run dev` and sign in as a `SUPER_ADMIN`.
2. Open the control panel → **Cron Jobs**.
3. Point one `TEAM_LEAD_EMAILS` entry at your own address before sending.
4. Run `send_action_item_digest` and check the job summary plus your inbox.

The digest is idempotent per IST date, team, and channel. A second run on the
same day reports `Already delivered for day ...`. To force a resend, delete the
matching `notificationDeliveries` document (id
`daily_action_items_digest__<date>__<teamKey>__EMAIL`).

The production routes require `Authorization: Bearer <CRON_SECRET>`:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://<deployment>/api/cron/send-action-item-digest?force=true"
```

## Troubleshooting

| Symptom                                    | Likely cause                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `535` / `Invalid login`                    | App Password wrong, revoked, or 2-Step Verification is off.                           |
| `invalid_grant`                            | Refresh token expired (Testing consent screen) or access was revoked. Re-mint it.     |
| `invalid_client`                           | Client id/secret belong to different projects, or the client was deleted.             |
| "Google hasn't verified this app"          | Expected for an unverified External app; choose **Advanced → Continue**.              |
| `No refresh token was returned`            | Revoke the app at `myaccount.google.com/permissions`, then re-run the script.         |
| Every recipient fails with the same reason | Check the `notificationDeliveries` doc; the reason includes the truncated SMTP error. |

Gmail sending limits: 500 recipients/day for consumer accounts, 2,000 for
Workspace, and 100 recipients per message over SMTP. The channel sends one
message per recipient, so the per-message cap is never an issue.

## Notes for serverless deployments

- Vercel blocks outbound port 25; ports 465 and 587 are open.
- Cron functions must finish sending before responding, which is why both
  notification routes set `maxDuration = 60` and await every send.
- The SMTP transport is cached per warm instance and reads credentials lazily, so
  a missing credential reports as a failed delivery instead of throwing at module
  load.
