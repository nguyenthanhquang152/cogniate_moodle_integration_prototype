// T7 runner: .env keys whose values must be redacted. Union of the original rule and the shared candidate rule.
import { isSecretCandidate } from '../../host/lib.mjs';

export function isCloneEnvSecret(key, value) {
  return (/PASSWORD|SECRET|KEY|TOKEN/i.test(key) && typeof value === 'string' && value.length >= 6) || isSecretCandidate(key, value);
}
