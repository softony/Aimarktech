/* =========================================================
   AIMARKTECH — analytics.js
   ---------------------------------------------------------
   Banner de consentimiento de cookies + Google Analytics 4.

   Es "enchufable": Google Analytics SOLO se activa si:
     1) configuras tu GA4_ID abajo, y
     2) el visitante ACEPTA las cookies en el banner.

   Si dejas GA4_ID vacío, NO se muestra banner ni se cargan
   cookies de rastreo: el sitio queda exactamente como hoy.

   Eventos disponibles (window.amkTrack):
     lead_capturado, diagnostico_completado, whatsapp_click, cta_click
   ========================================================= */
(function () {
  "use strict";

  /* ===== CONFIGURA AQUÍ TU ID DE GOOGLE ANALYTICS 4 =====
     Pega tu ID con formato G-XXXXXXXXXX.
     Déjalo vacío ("") para mantener el sitio sin analítica ni cookies. */
  var GA4_ID = "";
  /* ====================================================== */

  var CONSENT_KEY = "amk_cookie_consent"; // "granted" | "denied"
  var gaLoaded = false;

  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} }

  /* Carga Google Analytics 4 (solo tras consentimiento) */
  function loadGA() {
    if (gaLoaded || !GA4_ID) return;
    gaLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID, { anonymize_ip: true });
  }

  /* Helper global de eventos (no hace nada si GA no está activo) */
  window.amkTrack = function (name, params) {
    if (gaLoaded && window.gtag) {
      try { window.gtag("event", name, params || {}); } catch (e) {}
    }
  };

  /* ---------- Banner de cookies ---------- */
  function buildBanner() {
    if (document.querySelector(".cookie-bar")) return;
    var bar = document.createElement("div");
    bar.className = "cookie-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Aviso de cookies");
    bar.innerHTML =
      '<p class="cookie-text">Usamos cookies de analítica para entender cómo se usa el sitio y mejorarlo. ' +
      'Tú decides. Más información en nuestra <a href="cookies.html">Política de Cookies</a>.</p>' +
      '<div class="cookie-actions">' +
      '<button type="button" class="btn cookie-reject" id="cookieReject">Rechazar</button>' +
      '<button type="button" class="btn btn-primary" id="cookieAccept">Aceptar</button>' +
      '</div>';
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add("show"); });

    bar.querySelector("#cookieAccept").addEventListener("click", function () {
      setConsent("granted"); hideBanner(bar); loadGA();
    });
    bar.querySelector("#cookieReject").addEventListener("click", function () {
      setConsent("denied"); hideBanner(bar);
    });
  }

  function hideBanner(bar) {
    bar.classList.remove("show");
    setTimeout(function () { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }, 350);
  }

  function showBannerIfNeeded() {
    if (!GA4_ID) return;                 // sin Analytics configurado -> nada
    var c = getConsent();
    if (c === "granted") { loadGA(); return; }
    if (c === "denied") return;          // respetamos su rechazo
    buildBanner();                       // sin decisión previa -> mostrar
  }

  /* Reabrir el banner desde un enlace con [data-cookie-prefs] */
  function wirePrefs() {
    var nodes = document.querySelectorAll("[data-cookie-prefs]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener("click", function (e) {
        e.preventDefault();
        if (!GA4_ID) { alert("La analítica con cookies aún no está activada en este sitio."); return; }
        buildBanner();
      });
    }
  }

  /* Eventos automáticos: clic en WhatsApp y en CTAs principales */
  function wireAutoEvents() {
    document.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("a, button") : null;
      if (!el) return;
      var href = el.getAttribute ? (el.getAttribute("href") || "") : "";
      if (href.indexOf("wa.me") !== -1 || href.indexOf("whatsapp") !== -1) {
        window.amkTrack("whatsapp_click", { ubicacion: location.pathname });
      } else if (el.classList && el.classList.contains("btn-primary")) {
        window.amkTrack("cta_click", { texto: (el.textContent || "").trim().slice(0, 60) });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    showBannerIfNeeded();
    wirePrefs();
    wireAutoEvents();
  });
})();
