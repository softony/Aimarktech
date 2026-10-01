/* Ejemplo ilustrativo: no envía mensajes ni registra datos de visitantes. */
(() => {
  "use strict";
  const demo = document.getElementById("followupDemo");
  if (!demo) return;

  const detail = document.getElementById("demoDetail");
  const title = document.getElementById("demoStepTitle");
  const text = document.getElementById("demoStepText");
  const status = document.getElementById("demoStatus");
  const play = document.getElementById("demoPlay");
  const playLabel = document.getElementById("demoPlayLabel");
  const playSymbol = play.querySelector(".demo-play-symbol");
  const steps = [...demo.querySelectorAll("[data-demo-step]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const states = [
    { title: "Alguien se interesa", text: "La consulta llega.\nEl siguiente paso es atenderla\ny conocer qué necesita.", status: "Consulta por atender" },
    { title: "La información, a la mano", text: "Interés: horario por la tarde.\nEstado: respuesta pendiente.\nResponsable: recepción.", status: "Consulta registrada" },
    { title: "Ya sabes qué sigue", text: "Enviar opciones de horario.\nResponsable: recepción.\nRecordatorio: hoy, 16:00.", status: "Seguimiento organizado" },
  ];
  let current = 2;
  let timer = null;
  let playing = false;

  function render(index) {
    current = index;
    title.textContent = states[index].title;
    text.textContent = states[index].text;
    status.textContent = states[index].status;
    steps.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    detail.classList.remove("is-entering");
    if (!reducedMotion.matches) {
      void detail.offsetWidth;
      detail.classList.add("is-entering");
    }
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    playing = false;
    playLabel.textContent = "Ver secuencia";
    playSymbol.textContent = "▶";
  }

  function advance() {
    if (current < states.length - 1) {
      render(current + 1);
      if (current < states.length - 1) timer = setTimeout(advance, 3000);
      else stop();
    }
  }

  steps.forEach((button, index) => button.addEventListener("click", () => {
    stop();
    render(index);
  }));

  // Quien prefiere menos movimiento recorre el ejemplo a su propio ritmo.
  function updateMotionPreference() {
    stop();
    play.hidden = reducedMotion.matches;
    detail.classList.remove("is-entering");
  }
  play.addEventListener("click", () => {
    if (playing) { stop(); return; }
    playing = true;
    playLabel.textContent = "Pausar";
    playSymbol.textContent = "Ⅱ";
    render(0);
    timer = setTimeout(advance, 3000);
  });
  reducedMotion.addEventListener("change", updateMotionPreference);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) stop();
    });
    observer.observe(demo);
  }

  demo.querySelector(".demo-steps").hidden = false;
  updateMotionPreference();
})();
