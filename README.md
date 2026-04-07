# UChicago Chess Alumni Directory

This project runs on Cloudflare Pages Functions and stores alumni records plus the contributor whitelist in the `ALUMNI_KV` namespace.

## Required environment variables

- `ACCESS_TEAM_DOMAIN`: Your Cloudflare Access team domain, for example `https://my-team.cloudflareaccess.com`
- `ACCESS_AUD`: The Access application AUD tag to validate. If you protect multiple routes with separate Access apps, provide a comma-separated list.
- `ADMIN_EMAILS`: Comma-separated admin emails allowed to manage the whitelist and delete entries

## Cloudflare Access setup

1. Create a Cloudflare Access self-hosted application for the protected routes.
2. Protect at least `/admin.html`, `/contribute.html`, and the write APIs you want guarded.
3. Copy the application's AUD tag into `ACCESS_AUD`.
4. Add an allow policy for the population that should be able to authenticate.

The app performs a second authorization step after Access authentication:

- Emails in `ADMIN_EMAILS` can open the admin console, manage the whitelist, and delete alumni entries.
- Whitelisted emails stored in KV can submit alumni information.

## Data keys in `ALUMNI_KV`

- `alumni`
- `whitelist`

