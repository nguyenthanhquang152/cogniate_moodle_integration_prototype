import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { canvasEmbeddedScript } from './canvas-embedded.ts';

it('continues only in the top-level window and uses replace so Back does not reopen the continuation', () => {
  const replace = vi.fn();
  const window: { top?: unknown; location: { replace: typeof replace } } = { location: { replace } };
  window.top = window;
  runInNewContext(canvasEmbeddedScript('/play/ply_example'), { window });
  expect(replace).toHaveBeenCalledExactlyOnceWith('/play/ply_example');
  replace.mockClear();
  window.top = {};
  runInNewContext(canvasEmbeddedScript('/play/ply_example'), { window });
  expect(replace).not.toHaveBeenCalled();
});

it('quotes script-sensitive characters without creating another script element', () => {
  const target = '/play/ply_</script>"\u2028';
  const script = canvasEmbeddedScript(target);
  expect(script).not.toContain('</script>');
  const replace = vi.fn();
  const window: { top?: unknown; location: { replace: typeof replace } } = { location: { replace } };
  window.top = window;
  runInNewContext(script, { window });
  expect(replace).toHaveBeenCalledWith(target);
});
