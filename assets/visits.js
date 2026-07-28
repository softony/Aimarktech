/* =========================================================
   AIMARKTECH — visits.js (contador de visitas, frontend)
   ---------------------------------------------------------
   Muestra el total REAL de visitas al sitio en el footer,
   con un estilo "odómetro" (dígitos en cajitas) y animación
   de conteo al cargar.

   Cómo cuenta:
   - La PRIMERA carga de cada sesión del navegador suma +1
     (POST). Recargar la misma pestaña NO infla el número.
   - Las cargas siguientes solo leen el total (GET).

   Es "enchufable": si la función serverless no está
   configurada (sin Supabase), el contador simplemente
   no aparece y no rompe nada.
   ========================================================= */
(function () {
  "use strict";

  var ENDPOINT = "/api/visits";
  var SESSION_KEY = "amk_visit_counted";

  document.addEventListener("DOMContentLoaded", function () {
    var wrap = document.getElementById("visitCounter");
    var digitsEl = document.getElementById("visitDigits");
    if (!wrap || !digitsEl) return;

    // ¿Ya contamos esta visita en esta sesión del navegador?
    var alreadyCounted = false;
    try {
      alreadyCounted = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      /* sessionStorage bloqueado (modo privado): contamos igual */
    }

    var request = alreadyCounted
      ? fetch(ENDPOINT, { method: "GET" })
      : fetch(ENDPOINT, { method: "POST" });

    request
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.configured === false || typeof data.total !== "number") {
          // No configurado o error -> dejamos el contador oculto
          return;
        }
        if (!alreadyCounted) {
          try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
        }
        showCounter(wrap, digitsEl, data.total);
      })
      .catch(function () {
        /* Silencioso: si falla la red, no mostramos el contador */
      });
  });

  /* Muestra el contador y anima el conteo de 0 al total */
  function showCounter(wrap, digitsEl, total) {
    wrap.hidden = false;

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || total <= 0) {
      render(digitsEl, total, false);
      return;
    }

    // Animación de conteo ascendente (easing suave) ~1.2s
    var duration = 1200;
    var start = null;
    var lastShown = -1;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      var current = Math.round(eased * total);
      if (current !== lastShown) {
        render(digitsEl, current, true);
        lastShown = current;
      }
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        render(digitsEl, total, true);
      }
    }
    requestAnimationFrame(frame);
  }

  /* Dibuja el número como cajitas de dígitos con separadores de miles */
  function render(digitsEl, value, animateChange) {
    var text = String(Math.max(0, value));
    // Agrupar de a 3 desde la derecha para los separadores de miles
    var groups = [];
    for (var i = text.length; i > 0; i -= 3) {
      groups.unshift(text.slice(Math.max(0, i - 3), i));
    }
    var joined = groups.join(","); // ej. "12,345"

    var prev = digitsEl.children;
    var chars = joined.split("");

    // Reconstruimos solo si cambió la cantidad de elementos (longitud)
    if (prev.length !== chars.length) {
      digitsEl.innerHTML = "";
      chars.forEach(function (ch) {
        digitsEl.appendChild(makeCell(ch));
      });
      return;
    }

    // Misma longitud: actualizamos en sitio y marcamos cambios con "flip"
    chars.forEach(function (ch, idx) {
      var cell = prev[idx];
      if (cell.textContent !== ch) {
        cell.textContent = ch;
        if (animateChange && cell.classList.contains("digit")) {
          cell.classList.remove("flip");
          // Forzar reflow para reiniciar la animación
          void cell.offsetWidth;
          cell.classList.add("flip");
        }
      }
    });
  }

  function makeCell(ch) {
    var el = document.createElement("span");
    if (ch === ",") {
      el.className = "comma";
      el.textContent = ",";
    } else {
      el.className = "digit";
      el.textContent = ch;
    }
    return el;
  }
})();
