/* Muestras ilustrativas de la portada. No envían ni almacenan respuestas. */
(() => {
  "use strict";
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stories = document.getElementById("businessStories");
  if (!stories) return;
  const slides = [...stories.querySelectorAll("[data-story-panel]")];
  const tabs = [...stories.querySelectorAll("[data-story-index]")];
  const live = document.getElementById("storySlides");
  const play = document.getElementById("storyPlay");
  const playLabel = document.getElementById("storyPlayLabel");
  const playIcon = document.getElementById("storyPlayIcon");
  let current = 0, timer = null, playing = false, resumable = false;

  function controls() {
    playLabel.textContent = playing ? "Pausar" : resumable ? "Continuar" : current === slides.length - 1 ? "Repetir" : "Ver presentación";
    playIcon.textContent = playing ? "Ⅱ" : "▶";
    stories.classList.toggle("is-playing", playing);
    // La reproducción no interrumpe repetidamente a quien usa lector de pantalla.
    live.setAttribute("aria-live", playing ? "off" : "polite");
  }
  function render(index) {
    current = index;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
      slide.classList.remove("is-entering");
      slide.setAttribute("aria-hidden", String(i !== index));
    });
    if (!motion.matches) {
      void slides[index].offsetWidth;
      slides[index].classList.add("is-entering");
    }
    tabs.forEach((tab, i) => tab.setAttribute("aria-pressed", String(i === index)));
    controls();
  }
  function stop(resume = true) {
    clearTimeout(timer);
    timer = null;
    if (playing) resumable = resume && current < slides.length - 1;
    else if (!resume) resumable = false;
    playing = false;
    controls();
  }
  function advance() {
    render(current + 1);
    if (current < slides.length - 1) timer = setTimeout(advance, 12000);
    else stop(false);
  }
  tabs.forEach((tab, index) => tab.addEventListener("click", () => { stop(false); render(index); }));
  play.addEventListener("click", () => {
    if (playing) { stop(); return; }
    if (current === slides.length - 1) render(0);
    playing = true;
    resumable = false;
    controls();
    timer = setTimeout(advance, 12000);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(stories);
  }
  stories.querySelector(".story-tabs").hidden = false;

  const responses = [
    ["Empieza por delegar una tarea.", "Elige una actividad repetitiva, escribe sus pasos y acuerda quién se hará cargo."],
    ["Delega con criterios claros.", "Define qué puede decidir tu equipo y acuerda una revisión. No todo tiene que pasar por ti."],
    ["Revisa qué necesitas para crecer.", "Identifica la capacidad de tu equipo y el proceso que se saturaría si llegaran más clientes."],
  ];
  const express = [...document.querySelectorAll("[data-express-index]")];
  express.forEach((button, index) => button.addEventListener("click", () => {
    express.forEach((option, i) => option.setAttribute("aria-pressed", String(i === index)));
    document.getElementById("expressResultTitle").textContent = responses[index][0];
    document.getElementById("expressResultText").textContent = responses[index][1];
  }));
  document.querySelector(".express-options").hidden = false;

  const ribbon = document.getElementById("valueMarquee");
  const pauseRibbon = document.getElementById("valuePause");
  let ribbonPaused = false;
  pauseRibbon.addEventListener("click", () => {
    ribbonPaused = !ribbonPaused;
    ribbon.setAttribute("data-paused", String(ribbonPaused));
    pauseRibbon.setAttribute("aria-pressed", String(ribbonPaused));
    pauseRibbon.setAttribute("aria-label", ribbonPaused ? "Reanudar franja de valor" : "Pausar franja de valor");
    pauseRibbon.querySelector("span").textContent = ribbonPaused ? "▶" : "Ⅱ";
  });
  function motionPreference() {
    stop();
    play.hidden = motion.matches;
    pauseRibbon.hidden = motion.matches;
    slides.forEach(slide => slide.classList.remove("is-entering"));
  }
  motion.addEventListener("change", motionPreference);
  motionPreference();
})();
