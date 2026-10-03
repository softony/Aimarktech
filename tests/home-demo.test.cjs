// Controles de presentación, orientación express y pausa de la franja, con reloj simulado.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(`${__dirname}/../assets/home.js`, 'utf8');
function fixture(reduced = false) {
  const el = () => ({
    hidden: true, textContent: '', attributes: {}, listeners: {}, offsetWidth: 100,
    classList: {
      values: new Set(), add(name) { this.values.add(name); }, remove(name) { this.values.delete(name); },
      toggle(name, on) { if (on) this.add(name); else this.remove(name); },
    },
    addEventListener(event, fn) { this.listeners[event] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    click() { this.listeners.click(); },
  });
  const ids = Object.fromEntries(['businessStories', 'storySlides', 'storyPlay', 'storyPlayLabel', 'storyPlayIcon',
    'expressResultTitle', 'expressResultText', 'valueMarquee', 'valuePause'].map(id => [id, el()]));
  const slides = Array.from({ length: 4 }, el), tabs = Array.from({ length: 4 }, el);
  slides[0].classList.add('is-active');
  const choices = Array.from({ length: 3 }, el), tabsGroup = el(), options = el(), symbol = el();
  ids.businessStories.querySelectorAll = selector => selector === '[data-story-panel]' ? slides : tabs;
  ids.businessStories.querySelector = () => tabsGroup;
  ids.valuePause.querySelector = () => symbol;
  const media = { ...el(), matches: reduced };
  const doc = { ...el(), hidden: false, getElementById: id => ids[id], querySelectorAll: () => choices, querySelector: () => options };
  let timerId = 0, observer;
  const timers = new Map();
  vm.runInNewContext(source, {
    document: doc, window: { matchMedia: () => media, IntersectionObserver: true },
    IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} },
    setTimeout(fn, delay) { assert.equal(delay, 12000); timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { ids, slides, tabs, choices, tabsGroup, options, media, doc, timers,
    tick() { assert.equal(timers.size, 1); const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    offscreen() { observer([{ isIntersecting: false }]); },
  };
}
const f = fixture();
assert.equal(f.tabsGroup.hidden, false);
assert.equal(f.options.hidden, false);
assert.equal(f.ids.storyPlay.hidden, false);
assert.equal(f.timers.size, 0, 'La presentación espera a que el visitante decida verla');
f.ids.storyPlay.click();
assert.equal(f.ids.storySlides.attributes['aria-live'], 'off');
for (let i = 1; i < 4; i++) {
  f.tick();
  assert.equal(f.slides.filter(s => s.classList.values.has('is-active')).length, 1);
  assert.equal(f.slides[i].attributes['aria-hidden'], 'false');
  assert.equal(f.tabs[i].attributes['aria-pressed'], 'true');
}
assert.equal(f.timers.size, 0, 'La presentación termina sin bucle');
assert.equal(f.ids.storyPlayLabel.textContent, 'Repetir');
f.ids.storyPlay.click(); f.tick(); f.ids.storyPlay.click();
assert.equal(f.timers.size, 0);
assert.equal(f.ids.storyPlayLabel.textContent, 'Continuar');
f.ids.storyPlay.click(); f.tick();
assert.equal(f.slides[2].attributes['aria-hidden'], 'false', 'Continuar conserva el avance');
f.tabs[1].click();
assert.equal(f.timers.size, 0, 'Elegir un servicio detiene la reproducción');
assert.equal(f.ids.storySlides.attributes['aria-live'], 'polite');
assert.equal(f.slides[1].attributes['aria-hidden'], 'false');
f.ids.storyPlay.click(); f.offscreen();
assert.equal(f.timers.size, 0);
f.ids.storyPlay.click(); f.doc.hidden = true; f.doc.listeners.visibilitychange();
assert.equal(f.timers.size, 0);
f.ids.storyPlay.click(); f.media.matches = true; f.media.listeners.change();
assert.equal(f.timers.size, 0);
assert.equal(f.ids.storyPlay.hidden, true);
assert.equal(f.ids.valuePause.hidden, true);
assert.ok(f.slides.every(s => !s.classList.values.has('is-entering')));

const titles = new Set();
for (let i = 0; i < 3; i++) {
  f.choices[i].click();
  titles.add(f.ids.expressResultTitle.textContent);
  assert.ok(f.ids.expressResultText.textContent.length > 40);
  assert.equal(f.choices.filter(c => c.attributes['aria-pressed'] === 'true').length, 1);
}
assert.equal(titles.size, 3, 'Cada respuesta cambia la orientación');
f.ids.valuePause.click();
assert.equal(f.ids.valueMarquee.attributes['data-paused'], 'true');
assert.equal(f.ids.valuePause.attributes['aria-label'], 'Reanudar franja de valor');
f.ids.valuePause.click();
assert.equal(f.ids.valueMarquee.attributes['data-paused'], 'false');
const r = fixture(true);
r.tabs[3].click(); r.choices[2].click();
assert.equal(r.tabs[3].attributes['aria-pressed'], 'true');
assert.match(r.ids.expressResultTitle.textContent, /crecer/);
assert.equal(r.timers.size, 0, 'Movimiento reducido permite explorar sin reproducción');

const html = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');
assert.equal((html.match(/data-story-panel/g) || []).length, 4);
assert.equal((html.match(/data-express-index=/g) || []).length, 3);
for (const service of ['Marketing estratégico', 'Soporte técnico', 'Procesos + automatización', 'Escalamiento empresarial']) {
  assert.ok(html.includes(service), `El servicio ${service} debe estar representado`);
}
console.log('OK: cuatro servicios, reproducción/pausa/continuación, selección manual, accesibilidad, tres orientaciones, franja y movimiento reducido.');
