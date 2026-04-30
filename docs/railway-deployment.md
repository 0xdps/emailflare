# Railway Deployment Notes

## Runtime Requirements
- Service: `emailflare`
- Project: `devfound`
- Environment: `development`
- Public URL: `https://emailflare-development.up.railway.app`

## Required Environment Variables
- `NODE_ENV=production`
- `ADMIN_TOKEN=<secret>`
- `SESSION_SECRET=<secret>`
- `MESAHUB_URL=mh://local/emailflare`
- `CF_API_TOKEN=<secret>`
- `CF_ACCOUNT_ID=<cloudflare_account_id>`

## Persistence
- Attach a Railway volume to the `emailflare` service.
- Mount path must be `/data` for embedded Mesahub storage.

## Railway Build Constraint
- Railway build daemon rejects Docker `VOLUME` instructions.
- `Dockerfile` keeps `/data` directory creation but does not declare `VOLUME`.

## Cloudflare API Caveat
- For some account/zone contexts, Cloudflare endpoint
  `/zones/{zone_id}/email/sending/subdomains` may return `7003/404`
  even when UI subdomains are enabled.
- Backend currently supports manual fallback domain registration in this case.
