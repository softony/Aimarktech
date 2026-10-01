// Prueba de comportamiento de la secuencia sin depender del reloj del navegador.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(`${__dirname}/../assets/home.js`, 'utf8');
function fixture(reduced = false) {
  const el = () => ({
    hidden: true, textContent: '', attributes: {}, listeners: {}, offsetWidth: 100,
    classList: { add() {}, remove() {} },
    addEventListener(event, fn) { this.listeners[event] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    click() { this.listeners.click(); },
  });
  const ids = Object.fromEntries(['followupDemo','demoDetail','demoStepTitle','demoStepText','demoStatus','demoPlay','demoPlayLabel'].map(id => [id, el()]));
  const steps = [el(),el(),el()], stepGroup=el(), symbol=el();
  ids.followupDemo.querySelectorAll = () => steps;
  ids.followupDemo.querySelector = () => stepGroup;
  ids.demoPlay.querySelector = () => symbol;
  const media = {...el(), matches:reduced};
  const doc = {...el(), hidden:false, getElementById:id=>ids[id]};
  let timerId=0, observe;
  const timers=new Map();
  vm.runInNewContext(source, {
    document:doc,
    window:{matchMedia:()=>media,IntersectionObserver:true},
    IntersectionObserver:class {constructor(fn){observe=fn;} observe(){}},
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},
    clearTimeout(id){timers.delete(id);},
  });
  return {ids,steps,stepGroup,media,doc,timers,
    tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},
    offscreen(){observe([{isIntersecting:false}]);}
  };
}
const f=fixture();
assert.equal(f.stepGroup.hidden,false);
assert.equal(f.ids.demoPlay.hidden,false);
assert.equal(f.timers.size,0,'No debe reproducirse sola');
f.ids.demoPlay.click();
assert.equal(f.ids.demoStepTitle.textContent,'Alguien se interesa');
f.tick();
assert.equal(f.ids.demoStepTitle.textContent,'La información, a la mano');
f.tick();
assert.equal(f.ids.demoStepTitle.textContent,'Ya sabes qué sigue');
assert.equal(f.timers.size,0,'La secuencia termina sin bucle');
assert.equal(f.ids.demoPlayLabel.textContent,'Ver secuencia');
f.ids.demoPlay.click();f.ids.demoPlay.click();
assert.equal(f.timers.size,0,'Pausar cancela el siguiente paso');
f.ids.demoPlay.click();f.steps[1].click();
assert.equal(f.timers.size,0,'La selección manual cancela la reproducción');
assert.equal(f.steps[1].attributes['aria-pressed'],'true');
assert.equal(f.steps[0].attributes['aria-pressed'],'false');
f.ids.demoPlay.click();f.offscreen();
assert.equal(f.timers.size,0,'No continúa fuera de pantalla');
f.ids.demoPlay.click();f.doc.hidden=true;f.doc.listeners.visibilitychange();
assert.equal(f.timers.size,0,'No continúa en una pestaña oculta');
f.ids.demoPlay.click();f.media.matches=true;f.media.listeners.change();
assert.equal(f.timers.size,0);
assert.equal(f.ids.demoPlay.hidden,true);
const r=fixture(true);
assert.equal(r.ids.demoPlay.hidden,true);
assert.equal(r.stepGroup.hidden,false);
r.steps[1].click();
assert.equal(r.ids.demoStepTitle.textContent,'La información, a la mano');
assert.equal(r.timers.size,0);
console.log('OK: secuencia completa, pausa, selección manual, fin sin bucle, fuera de pantalla y movimiento reducido.');
