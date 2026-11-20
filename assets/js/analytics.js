(function () {
  // Номер счётчика Яндекс Метрики: вписать сюда, остальное подключится само.
  const YM_ID = null;

  if (YM_ID) {
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    window.ym(YM_ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  window.track = function (goal, params) {
    try {
      if (YM_ID && typeof window.ym === "function") window.ym(YM_ID, "reachGoal", goal, params || {});
    } catch (e) {}
    if (!YM_ID) console.info("[Метрика: цель]", goal, params || "");
  };

  document.addEventListener("click", function (e) {
    const el = e.target.closest("a, button");
    if (!el) return;
    if (el.dataset.goal) window.track(el.dataset.goal, { page: location.pathname });
    const href = el.getAttribute("href") || "";
    if (href.startsWith("tel:")) window.track("call_click");
    else if (href.includes("wa.me")) window.track("whatsapp_click");
    else if (href.includes("t.me")) window.track("telegram_click");
    else if (href.includes("instagram.com")) window.track("instagram_click");
  }, true);
})();
