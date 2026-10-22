import { expect, it } from 'vitest';
import setup from './app.ts';
import manifest from './manifest.ts';
import profiles from './lti-profiles.ts';

it('AC-LA-E1-07-10: offered profile data matches LTI traits and covers every registration profile', () => {
  for (const [id, data] of Object.entries(setup.profiles)) {
    const source = profiles.find((p) => p.id === id);
    expect(source, id).toBeDefined();
    expect(data.sharing, id).toBe(source!.sharing);
    expect(data.serviceUrl, id).toBe(source!.serviceUrl);
    expect(data.refusedHostSuffixes, id).toEqual('refusedHostSuffixes' in source! ? source!.refusedHostSuffixes : undefined);
    expect(setup.sharingOf(id), id).toBe(source!.sharing);
  }
  for (const registration of manifest.registration) {
    for (const id of registration.profiles) expect(setup.profiles[id], id).toBeDefined();
  }
});
