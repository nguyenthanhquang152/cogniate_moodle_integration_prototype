# Where routes go

One file per route group, each `register…Routes(app, ctx: RouteContext)`: `protocol.ts` (Moodle and browser: keys, login, launch), `idtoken.ts`, `services.ts` (deep linking, line items, scores), `platforms.ts` (admin), `registration.ts` (dynamic registration).
Domain rules live in `src/lti/`, platform calls in `src/platform/`, SQL in `src/store/`; a route file only parses, authorizes and calls them.
T3c compatibility routes (`/api/deeplinking/form`, `/message`, line item writes, memberships, OAuth stubs) go to `compat.ts`.
