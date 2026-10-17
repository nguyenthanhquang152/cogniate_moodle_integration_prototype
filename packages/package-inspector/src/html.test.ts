import { describe, expect, it } from 'vitest';
import { cssUrls, externalHost, scanHtml, srcsetUrls } from './html.ts';

const hostsOf = (html: string): string[] =>
  [...new Set(scanHtml(html).resourceUrls.map(externalHost).filter((h): h is string => h !== null))].sort();

describe('resource-host rule (contract §3: only URLs that load a resource)', () => {
  it('counts src, srcset, poster, <link href>, <base href>, CSS url() and @import', () => {
    expect(hostsOf(`
      <img src="https://a.example/x.png">
      <img srcset="https://b.example/1.png 1x, https://c.example/2.png 2x">
      <video poster="https://d.example/p.jpg"><source src="//e.example/v.mp4"></video>
      <link rel="stylesheet" href="https://f.example/s.css">
      <base href="https://g.example/">
      <style>@font-face { src: url('https://h.example/f.woff2') } @import "https://i.example/x.css";</style>
      <div style="background: url(https://j.example/bg.png)"></div>
      <script src="https://k.example/x.js"></script>
    `)).toEqual(['a.example', 'b.example', 'c.example', 'd.example', 'e.example', 'f.example', 'g.example', 'h.example', 'i.example', 'j.example', 'k.example']);
  });

  it('does not count plain links, comments, inline script text, xmlns, data: URLs or relative URLs', () => {
    expect(hostsOf(`
      <a href="https://link.example/">x</a>
      <!-- <img src="https://comment.example/x.png"> -->
      <script>const u = "https://script.example/x.png"; tailwind.config = {}; </script>
      <svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>
      <img src="data:image/png;base64,AAAA"><img src="assets/logo.svg"><img src="/abs.png">
      <style>/* url(https://css-comment.example/x) */ .a { color: red }</style>
      <template><img src="https://template.example/x.png"></template>
      <form action="https://form.example/"></form>
    `)).toEqual([]);
  });

  it('reads question ids in document order', () => {
    expect(scanHtml('<div data-cog-quiz="B"></div><section><div data-cog-quiz=" A "></div></section><div data-cog-quiz=""></div>').questionIds).toEqual(['B', 'A']);
  });

  it('externalHost: lower case, protocol-relative and backslash forms; null for other schemes', () => {
    expect(externalHost('HTTPS://Fonts.GStatic.com/x')).toBe('fonts.gstatic.com');
    expect(externalHost('//cdn.example/x')).toBe('cdn.example');
    expect(externalHost('https:\\\\cdn.example\\x')).toBe('cdn.example');
    expect(externalHost(' https://x.example ')).toBe('x.example');
    for (const v of ['data:x', 'blob:https://x.example/1', 'javascript:alert(1)', 'img/a.png', '/a.png', 'mailto:a@b.example', '']) {
      expect(externalHost(v)).toBeNull();
    }
  });

  it('cssUrls: quotes, no quotes, an open comment to the end', () => {
    expect(cssUrls(`a{b:url("x")} c{d:url('y')} e{f:url( z )} @import 'w'; /* url(hidden) */`)).toEqual(['x', 'y', 'z', 'w']);
    expect(cssUrls('a{b:url(x)} /* url(hidden)')).toEqual(['x']);
  });

  it('srcsetUrls drops descriptors', () => {
    expect(srcsetUrls('a.png 1x, b.png 2x,c.png 300w')).toEqual(['a.png', 'b.png', 'c.png']);
    expect(srcsetUrls('data:image/png;base64,AA== 1x, https://x.example/a,b.png 2x, last.png,')).toEqual(['data:image/png;base64,AA==', 'https://x.example/a,b.png', 'last.png']);
  });
});
