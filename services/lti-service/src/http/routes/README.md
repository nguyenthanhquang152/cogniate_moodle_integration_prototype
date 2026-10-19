# Where routes go

One file per route group, each `register…Routes(app, ctx: RouteContext)`: `protocol.ts` (Moodle and browser: keys, login, launch), `idtoken.ts`, `services.ts` (deep linking, line items, scores), `platforms.ts` (admin), `registration.ts` (dynamic registration).
Domain rules live in `src/lti/`, platform calls in `src/platform/`, SQL in `src/store/`; a route file only parses, authorizes and calls them.
T3c compatibility routes (`/api/deeplinking/form`, `/message`, line item writes, memberships, OAuth stubs) go to `compat.ts`.

## ltiaas 0.0.4 compatibility sites

Search `src/` for `ltiaas-0.0.4 tolerance`. Contract §8 D14/D15 defines these SDK tolerances:

- `http/app.ts`: fold leading slashes only.
- `http/validation.ts`: decode one extra HTTPS layer in a line item id, then check the final URL (D15).
- `http/routes/services.ts`: accept the `user_id` score query alias; refuse conflicting values.
- `lti/deep-linking.ts`: use the default launch URL for a null URL; map null custom data to an empty object.
- `platform/ags.ts`: omit a null score comment.
- `lti/idtoken.ts`: return `outcomes: { available: false }`.

The URL guard in `lti/service-url.ts` also refuses encoded query and fragment delimiters (`%3F`, `%23`) in paths (A-T3c-03). It still accepts the SDK's bounded second encoding layer.
