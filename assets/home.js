/* Conversación ilustrativa: no envía mensajes, reserva citas ni guarda datos. */
(() => {
  "use strict";
  const demo = document.getElementById("followupDemo");
  if (!demo) return;

  const detail = document.getElementById("demoDetail");
  const title = document.getElementById("demoStepTitle");
  const text = document.getElementById("demoStepText");
  const status = document.getElementById("demoStatus");
  const message = document.getElementById("demoMessage");
  const speaker = document.getElementById("demoSpeaker");
  const messageText = document.getElementById("demoMessageText");
  const previousMessage = document.getElementById("demoPreviousMessage");
  const previousSpeaker = document.getElementById("demoPreviousSpeaker");
  const previousText = document.getElementById("demoPreviousText");
  const choices = document.getElementById("demoChoices");
  const progress = document.getElementById("demoProgress");
  const play = document.getElementById("demoPlay");
  const playLabel = document.getElementById("demoPlayLabel");
  const playSymbol = play.querySelector(".demo-play-symbol");
  const steps = [...demo.querySelectorAll("[data-demo-step]")];
  const slots = [...demo.querySelectorAll("[data-demo-slot]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const speakers = { client: "Cliente", agent: "Tu agente de IA" };
  const stepDuration = 4500;
  let selectedSlot = "4:00 p. m.";
  let current = 1;
  let timer = null;
  let playing = false;
  let canResume = false;

  function conversation() {
    return [
      { speaker: "client", message: "Hola, ¿tienen una cita para mañana por la tarde?", title: "El cliente pregunta", text: "Una persona consulta disponibilidad. Su mensaje inicia la atención en el canal de tu negocio.", status: "Nueva consulta" },
      { speaker: "agent", message: "¡Hola! Tenemos 4:00 o 6:00 p. m. ¿Qué horario prefieres?", title: "Tu agente responde", text: "Ofrece los horarios que definiste y ayuda al cliente a elegir.", status: "Atención inicial" },
      { speaker: "client", message: `A las ${selectedSlot}, por favor.`, title: "El cliente elige", text: `La conversación identifica su preferencia: mañana a las ${selectedSlot}`, status: "Preferencia identificada" },
      { speaker: "agent", message: `Listo, registré tu solicitud para mañana a las ${selectedSlot} Nuestro equipo te confirmará la cita.`, title: "Tu equipo da seguimiento", text: `Recepción recibe el horario elegido: ${selectedSlot} Su siguiente tarea es confirmar la cita.`, status: "Seguimiento organizado" },
    ];
  }

  function updatePlayLabel() {
    playLabel.textContent = playing ? "Pausar" : canResume ? "Continuar" : current === 3 ? "Repetir" : "Ver conversación";
    playSymbol.textContent = playing ? "Ⅱ" : "▶";
  }

  function render(index, animate = true) {
    current = index;
    const states = conversation();
    const state = states[index];
    speaker.textContent = speakers[state.speaker];
    messageText.textContent = state.message;
    message.setAttribute("data-speaker", state.speaker);
    previousMessage.hidden = index === 0;
    if (index > 0) {
      const previous = states[index - 1];
      previousSpeaker.textContent = speakers[previous.speaker];
      previousText.textContent = previous.message;
      previousMessage.setAttribute("data-speaker", previous.speaker);
    }
    title.textContent = state.title;
    text.textContent = state.text;
    status.textContent = state.status;
    choices.hidden = index !== 1;
    progress.hidden = index === 1;
    progress.textContent = `Paso ${index + 1} de 4 · ${state.title}`;
    steps.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    [message, detail].forEach(element => {
      element.classList.remove("is-entering");
      if (animate && !reducedMotion.matches) {
        void element.offsetWidth;
        element.classList.add("is-entering");
      }
    });
    updatePlayLabel();
  }

  function stop(allowResume = true) {
    clearTimeout(timer);
    timer = null;
    if (playing) canResume = allowResume && current < 3;
    else if (!allowResume) canResume = false;
    playing = false;
    updatePlayLabel();
  }

  function advance() {
    render(current + 1);
    if (current < 3) timer = setTimeout(advance, stepDuration);
    else stop(false);
  }

  function start() {
    playing = true;
    canResume = false;
    updatePlayLabel();
    timer = setTimeout(advance, stepDuration);
  }

  steps.forEach((button, index) => button.addEventListener("click", () => {
    stop(false);
    render(index);
  }));

  slots.forEach(button => button.addEventListener("click", () => {
    const slot = button.getAttribute("data-demo-slot");
    if (!["4:00 p. m.", "6:00 p. m."].includes(slot)) return;
    selectedSlot = slot;
    stop(false);
    render(2);
    // La opción se oculta al avanzar; mantener el foco en un control visible.
    steps[2].focus({ preventScroll: true });
    if (!reducedMotion.matches) start();
  }));

  play.addEventListener("click", () => {
    if (playing) { stop(); return; }
    if (!canResume) render(0);
    start();
  });

  function updateMotionPreference() {
    stop();
    play.hidden = reducedMotion.matches;
    message.classList.remove("is-entering");
    detail.classList.remove("is-entering");
  }
  reducedMotion.addEventListener("change", updateMotionPreference);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) stop();
    });
    observer.observe(demo);
  }

  demo.querySelector(".demo-steps").hidden = false;
  render(1, false);
  updateMotionPreference();
})();
