/* =========================================================
   AIMARKTECH — intro.js  ·  Intro animada de marca
   ---------------------------------------------------------
   Al cargar el home, una capa a pantalla completa muestra
   las partículas formando la letra "A" sobre el degradado de
   marca; tras sostenerse un instante, la capa se desvanece y
   revela el sitio.

   - Se muestra UNA sola vez por sesión (sessionStorage).
   - Botón "Saltar intro" siempre disponible.
   - Respeta prefers-reduced-motion (no se reproduce).

   El parpadeo en visitas repetidas se evita con un pequeño
   script inline en el <head> que añade la clase 'intro-seen'
   a <html> antes de pintar (ver index.html).
   ========================================================= */
(function () {
  "use strict";

  // Si ya se vio en esta sesión o el usuario pidió menos animación, no hacer nada.
  if (document.documentElement.classList.contains("intro-seen")) return;

  document.addEventListener("DOMContentLoaded", function () {
    var overlay = document.getElementById("introOverlay");
    var canvas = document.getElementById("introCanvas");
    var skip = document.getElementById("introSkip");
    if (!overlay || !canvas) return;

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;
    var particles = [];
    var raf = null;
    var done = false;
    var formedAt = 0;

    // Colores de marca
    var NODE = "rgba(10,116,218,0.95)";   // azul
    var NODE2 = "rgba(0,194,255,0.95)";   // cyan
    var GREEN = "rgba(40,167,69,0.95)";   // verde (base de la A)

    function size() {
      w = overlay.clientWidth;
      h = overlay.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Puntos a lo largo de los trazos de la letra "A" (coords centradas en 0) */
    function letterAPoints(total) {
      var apex = [0, -0.46], bl = [-0.30, 0.46], br = [0.30, 0.46];
      function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
      var tcb = 0.62; // posición del travesaño
      var lc = lerp(apex, bl, tcb), rc = lerp(apex, br, tcb);
      var segs = [[apex, bl], [apex, br], [lc, rc]]; // pierna izq, pierna der, travesaño
      var lens = segs.map(function (s) { return Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]); });
      var tot = lens.reduce(function (a, b) { return a + b; }, 0);
      var pts = [];
      for (var s = 0; s < segs.length; s++) {
        var n = Math.max(2, Math.round((total * lens[s]) / tot));
        for (var i = 0; i < n; i++) pts.push(lerp(segs[s][0], segs[s][1], n > 1 ? i / (n - 1) : 0));
      }
      return pts;
    }

    function build() {
      var L = Math.min(w, h) * 0.52;
      var cx = w * 0.5, cy = h * 0.44;
      var pool = letterAPoints(170);

      // Baraja (Fisher-Yates) para una formación orgánica
      for (var i = pool.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }

      particles = pool.map(function (pt) {
        var jx = (Math.random() - 0.5) * 4, jy = (Math.random() - 0.5) * 4;
        return {
          x: Math.random() * w, y: Math.random() * h,
          tx: cx + pt[0] * L + jx, ty: cy + pt[1] * L + jy,
          r: 1.5 + Math.random() * 2.1,
          c: pt[1] > 0.2 ? GREEN : (Math.random() > 0.5 ? NODE : NODE2),
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // Líneas tipo constelación entre partículas cercanas
      var maxd = Math.min(w, h) * 0.075;
      ctx.lineWidth = 1;
      for (var i = 0; i < particles.length; i++) {
        var a = particles[i];
        for (var j = i + 1; j < particles.length; j++) {
          var b = particles[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.hypot(dx, dy);
          if (d < maxd) {
            ctx.strokeStyle = "rgba(0,194,255," + ((1 - d / maxd) * 0.28) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nodos con brillo neón
      ctx.shadowBlur = 10;
      for (var k = 0; k < particles.length; k++) {
        var p = particles[k];
        ctx.shadowColor = p.c;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    function step() {
      var allClose = true;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += (p.tx - p.x) * 0.085;
        p.y += (p.ty - p.y) * 0.085;
        if (Math.abs(p.tx - p.x) > 1.2 || Math.abs(p.ty - p.y) > 1.2) allClose = false;
      }
      draw();

      if (allClose) {
        if (!formedAt) {
          formedAt = performance.now();
          overlay.classList.add("formed"); // dispara el fade-in del nombre de marca
        } else if (performance.now() - formedAt > 1100) {
          finish();
          return;
        }
      }
      raf = requestAnimationFrame(step);
    }

    function finish() {
      if (done) return;
      done = true;
      if (raf) cancelAnimationFrame(raf);
      try { sessionStorage.setItem("amk_intro", "1"); } catch (e) {}
      overlay.classList.add("hide");
      setTimeout(function () { if (overlay && overlay.parentNode) overlay.style.display = "none"; }, 800);
    }

    if (skip) skip.addEventListener("click", finish);
    window.addEventListener("resize", size);

    size();
    build();
    raf = requestAnimationFrame(step);

    // Red de seguridad: nunca bloquear más de ~6.5s
    setTimeout(finish, 6500);
  });
})();
