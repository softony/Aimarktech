// Verifica la conversación con reloj simulado, sin enviar mensajes ni reservar citas.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(`${__dirname}/../assets/home.js`, 'utf8');

function fixture(reduced = false) {
  const el = () => ({
    hidden: true, textContent: '', attributes: {}, listeners: {}, offsetWidth: 100,
    focused: false,
    classList: { values: new Set(), add(name) { this.values.add(name); }, remove(name) { this.values.delete(name); } },
    addEventListener(event, fn) { this.listeners[event] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    focus() { this.focused = true; },
    click() { this.listeners.click(); },
  });
  const ids = Object.fromEntries([
    'followupDemo', 'demoDetail', 'demoStepTitle', 'demoStepText', 'demoStatus',
    'demoMessage', 'demoSpeaker', 'demoMessageText', 'demoPreviousMessage',
    'demoPreviousSpeaker', 'demoPreviousText', 'demoChoices', 'demoProgress',
    'demoPlay', 'demoPlayLabel',
  ].map(id => [id, el()]));
  const steps = Array.from({ length: 4 }, el), stepGroup = el(), symbol = el();
  const slots = ['4:00 p. m.', '6:00 p. m.'].map(value => {
    const button = el(); button.setAttribute('data-demo-slot', value); return button;
  });
  ids.followupDemo.querySelectorAll = selector => selector === '[data-demo-step]' ? steps : slots;
  ids.followupDemo.querySelector = () => stepGroup;
  ids.demoPlay.querySelector = () => symbol;
  const media = { ...el(), matches: reduced };
  const doc = { ...el(), hidden: false, getElementById: id => ids[id] };
  let timerId = 0, observe;
  const timers = new Map();
  vm.runInNewContext(source, {
    document: doc,
    window: { matchMedia: () => media, IntersectionObserver: true },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { ids, steps, slots, stepGroup, media, doc, timers,
    tick() { assert.equal(timers.size, 1); const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    offscreen() { observe([{ isIntersecting: false }]); },
  };
}

const f = fixture();
assert.equal(f.stepGroup.hidden, false);
assert.equal(f.ids.demoPlay.hidden, false);
assert.equal(f.timers.size, 0, 'No se reproduce sola al cargar');
assert.equal(f.ids.demoChoices.hidden, false, 'La primera vista invita a elegir un horario');
assert.equal(f.ids.demoSpeaker.textContent, 'Tu agente de IA');
assert.equal(f.ids.demoPreviousSpeaker.textContent, 'Cliente');
assert.notEqual(f.ids.demoMessageText.textContent, f.ids.demoPreviousText.textContent);

f.ids.demoPlay.click();
const messages = [];
for (let stage = 0; stage < 4; stage++) {
  if (stage) f.tick();
  messages.push(f.ids.demoMessageText.textContent);
  assert.equal(f.ids.demoSpeaker.textContent, stage % 2 ? 'Tu agente de IA' : 'Cliente');
  assert.equal(f.ids.demoPreviousMessage.hidden, stage === 0);
  if (stage) assert.equal(f.ids.demoPreviousText.textContent, messages[stage - 1]);
  assert.equal(f.ids.demoStepTitle.textContent, [
    'El cliente pregunta', 'Tu agente responde', 'El cliente elige', 'Tu equipo da seguimiento',
  ][stage]);
  assert.equal(f.steps[stage].attributes['aria-pressed'], 'true');
}
assert.equal(new Set(messages).size, 4, 'Cada paso cambia el mensaje de la conversación');
assert.match(messages[3], /Nuestro equipo te confirmará la cita/);
assert.equal(f.ids.demoStatus.textContent, 'Seguimiento organizado');
assert.equal(f.timers.size, 0, 'La secuencia termina sin bucle');
assert.equal(f.ids.demoPlayLabel.textContent, 'Repetir');

f.ids.demoPlay.click(); f.tick(); f.ids.demoPlay.click();
assert.equal(f.timers.size, 0, 'Pausar cancela el siguiente paso');
assert.equal(f.ids.demoPlayLabel.textContent, 'Continuar');
f.ids.demoPlay.click();
assert.equal(f.ids.demoStepTitle.textContent, 'Tu agente responde', 'Continuar no reinicia');
f.tick();
assert.equal(f.ids.demoStepTitle.textContent, 'El cliente elige');
f.steps[1].click();
assert.equal(f.timers.size, 0, 'La selección manual cancela la reproducción');
assert.equal(f.steps[2].attributes['aria-pressed'], 'false');

// La elección del visitante se conserva en la respuesta y en la tarea de recepción.
for (const [index, time] of [[1, '6:00'], [0, '4:00']]) {
  f.steps[1].click(); f.slots[index].click();
  assert.match(f.ids.demoMessageText.textContent, new RegExp(time));
  assert.match(f.ids.demoStepText.textContent, new RegExp(time));
  assert.equal(f.ids.demoChoices.hidden, true);
  assert.equal(f.steps[2].focused, true, 'El foco permanece en un control visible');
  f.tick();
  assert.match(f.ids.demoPreviousText.textContent, new RegExp(time));
  assert.match(f.ids.demoMessageText.textContent, new RegExp(time));
  assert.match(f.ids.demoStepText.textContent, new RegExp(time));
  assert.doesNotMatch(f.ids.demoMessageText.textContent, /\.\./);
  assert.equal(f.timers.size, 0);
}

f.ids.demoPlay.click(); f.offscreen();
assert.equal(f.timers.size, 0, 'No continúa fuera de pantalla');
f.ids.demoPlay.click(); f.doc.hidden = true; f.doc.listeners.visibilitychange();
assert.equal(f.timers.size, 0, 'No continúa en una pestaña oculta');
f.ids.demoPlay.click(); f.media.matches = true; f.media.listeners.change();
assert.equal(f.timers.size, 0);
assert.equal(f.ids.demoPlay.hidden, true);
assert.equal(f.ids.demoMessage.classList.values.has('is-entering'), false);
const r = fixture(true);
assert.equal(r.ids.demoPlay.hidden, true);
assert.equal(r.stepGroup.hidden, false);
r.slots[1].click();
assert.equal(r.ids.demoStepTitle.textContent, 'El cliente elige');
assert.equal(r.timers.size, 0, 'Movimiento reducido conserva la elección sin avance automático');
r.steps[3].click();
assert.match(r.ids.demoMessageText.textContent, /6:00/);
assert.equal(r.ids.demoMessage.classList.values.has('is-entering'), false);
console.log('OK: diálogo en cuatro pasos, dos horarios, seguimiento sincronizado, foco, pausa/continuación, fin sin bucle y movimiento reducido.');
