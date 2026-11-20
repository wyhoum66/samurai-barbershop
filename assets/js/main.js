(function () {
  const D = window.SAMURAI;
  const C = D.contacts;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const page = document.body.dataset.page || "home";

  const fmt = (n) => n.toLocaleString("ru-RU").replace(/ /g, " ");
  const plural = (n, f) => f[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2];
  const durText = (m) => m >= 60 ? (Math.floor(m / 60) + " ч" + (m % 60 ? " " + (m % 60) + " мин" : "")) : m + " мин";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const STEP = 30;
  const SLOTS = (C.close - C.open) * 60 / STEP;
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const keyToDate = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const idxToTime = (i) => { const m = C.open * 60 + i * STEP; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };

  function rng(seed) {
    let h = 2166136261;
    for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }

  const Slots = {
    STEP, SLOTS, dayKey, keyToDate, idxToTime,
    bookings() { return store.get("samurai.bookings", []); },
    saveBookings(list) { store.set("samurai.bookings", list); },
    baseBusy(masterId, key) {
      const m = D.masters.find((x) => x.id === masterId);
      const r = rng(masterId + key);
      const dow = keyToDate(key).getDay();
      const p = (m ? m.busy : .35) + (dow === 5 || dow === 6 ? .1 : 0) + (dow === 1 ? -.08 : 0);
      const busy = new Set();
      let i = 0;
      while (i < SLOTS) {
        if (r() < p) {
          const len = 1 + (r() < .55 ? 1 : 0) + (r() < .25 ? 1 : 0);
          for (let j = 0; j < len && i + j < SLOTS; j++) busy.add(i + j);
          i += len;
        } else i++;
      }
      return busy;
    },
    busy(masterId, key) {
      const set = this.baseBusy(masterId, key);
      this.bookings().filter((b) => b.master === masterId && b.date === key)
        .forEach((b) => { for (let j = 0; j < b.slots; j++) set.add(b.start + j); });
      return set;
    },
    minStart(key) {
      const now = new Date();
      if (key !== dayKey(now)) return 0;
      const mins = now.getHours() * 60 + now.getMinutes() + 30 - C.open * 60;
      return Math.max(0, Math.ceil(mins / STEP));
    },
    freeStarts(masterId, key, need) {
      const busy = this.busy(masterId, key);
      const out = [];
      for (let s = this.minStart(key); s + need <= SLOTS; s++) {
        let ok = true;
        for (let j = 0; j < need; j++) if (busy.has(s + j)) { ok = false; break; }
        if (ok) out.push(s);
      }
      return out;
    },
    nextFree(masterId, need = 2) {
      const d = new Date();
      for (let k = 0; k < 14; k++) {
        const key = dayKey(d);
        const f = this.freeStarts(masterId, key, need);
        if (f.length) return { key, start: f[0] };
        d.setDate(d.getDate() + 1);
      }
      return null;
    },
    dayLabel(key) {
      const t = dayKey(new Date());
      const tm = new Date(); tm.setDate(tm.getDate() + 1);
      if (key === t) return "сегодня";
      if (key === dayKey(tm)) return "завтра";
      return keyToDate(key).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
  };

  let samuraiSvg = null;
  const samuraiReady = fetch("assets/img/samurai.svg").then((r) => r.text()).then((t) => (samuraiSvg = t)).catch(() => null);
  function paintSamurai(root = document) {
    $$("[data-samurai]", root).forEach((el) => {
      if (el.dataset.painted) return;
      el.innerHTML = samuraiSvg || '<img src="assets/img/samurai.svg" alt="" style="width:100%;filter:invert(1)">';
      el.dataset.painted = "1";
    });
  }

  const NAV = [
    ["index.html", "Главная", "home"],
    ["services.html", "Услуги и цены", "services"],
    ["masters.html", "Мастера", "masters"],
    ["gallery.html", "Работы", "gallery"],
    ["reviews.html", "Отзывы", "reviews"],
    ["contacts.html", "Контакты", "contacts"]
  ];

  const MESSENGERS = [["tg", "Telegram", C.telegram], ["wa", "WhatsApp", C.whatsapp], ["max", "MAX", C.max]];
  const icon = (id) => `<svg class="ico" aria-hidden="true"><use href="assets/img/icons.svg#${id}"></use></svg>`;
  const messengerButtons = () => MESSENGERS.map(([k, label, href]) =>
    `<a class="msg msg--${k}" href="${href}" target="_blank" rel="noopener"><span class="msg__ico">${icon(k)}</span><span class="msg__txt"><b>${label}</b><small>Написать</small></span><i class="ti ti-arrow-up-right"></i></a>`).join("");

  const RAIL = [["侍", "самурай"], ["武士道", "бусидо — путь воина"], ["道", "путь"], ["一期一会", "одна встреча — один шанс"], ["刀", "клинок"], ["七転び八起き", "упади семь раз, встань восемь"], ["心", "дух"], ["散髪", "стрижка"], ["美", "красота"], ["無心", "чистый ум"]];
  function rail() {
    const el = document.createElement("aside");
    el.className = "kanji-rail";
    el.setAttribute("aria-hidden", "true");
    const words = RAIL.concat(RAIL).map(([k, ru]) => `<span class="kanji-rail__word" title="${ru}"><b class="kanji">${k}</b><i></i></span>`).join("");
    el.innerHTML = `<div class="kanji-rail__line"><span></span></div><div class="kanji-rail__track">${words}</div>`;
    document.body.prepend(el);
    const track = $(".kanji-rail__track", el), bar = $(".kanji-rail__line span", el);
    let ticking = false;
    const upd = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      track.style.transform = `translateY(${-p * Math.max(0, track.scrollHeight / 2 - innerHeight * .4)}px)`;
      bar.style.transform = `scaleY(${p})`;
      ticking = false;
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener("resize", upd);
    upd();
  }

  function header() {
    const links = NAV.map(([h, t, id]) => `<a href="${h}"${id === page ? ' aria-current="page"' : ""}>${t}</a>`).join("");
    const el = document.createElement("header");
    el.className = "site-header";
    el.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html" aria-label="Самурай — на главную">
          <span class="brand__mark" data-samurai></span>
          <span class="brand__text"><span class="brand__name">Самурай</span><span class="brand__sub">барбершоп</span></span>
        </a>
        <nav class="nav" aria-label="Главное меню">${links}</nav>
        <div class="header-actions">
          <a class="header-phone" href="${C.phoneHref}">${C.phone}</a>
          <a class="header-call" href="${C.phoneHref}" aria-label="Позвонить"><i class="ti ti-phone"></i></a>
          <a class="btn btn--sm header-book" href="booking.html" data-goal="booking_cta_header">Записаться</a>
          <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false"><i class="ti ti-menu-2"></i></button>
        </div>
      </div>`;
    document.body.prepend(el);

    const mm = document.createElement("div");
    mm.className = "mobile-menu";
    mm.setAttribute("aria-hidden", "true");
    mm.innerHTML = `
      <div class="mobile-menu__top">
        <a class="brand" href="index.html"><span class="brand__mark" data-samurai></span><span class="brand__text"><span class="brand__name">Самурай</span><span class="brand__sub">барбершоп</span></span></a>
        <button class="burger" type="button" aria-label="Закрыть меню" style="display:inline-flex"><i class="ti ti-x"></i></button>
      </div>
      <nav>${NAV.map(([h, t, id]) => `<a href="${h}"${id === page ? ' aria-current="page"' : ""}>${t}<i class="ti ti-arrow-right"></i></a>`).join("")}</nav>
      <div class="mobile-menu__bottom">
        <a class="btn btn--block" href="booking.html" data-goal="booking_cta_menu">Записаться онлайн</a>
        <a class="btn btn--ghost btn--block" href="${C.phoneHref}"><i class="ti ti-phone"></i>${C.phone}</a>
      </div>`;
    document.body.append(mm);

    const burgers = $$(".burger");
    const toggle = (open) => {
      mm.classList.toggle("is-open", open);
      mm.setAttribute("aria-hidden", String(!open));
      burgers[0].setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    burgers[0].addEventListener("click", () => toggle(true));
    burgers[1].addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });

    const onScroll = () => el.classList.toggle("is-solid", window.scrollY > 24 || page !== "home");
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function footer() {
    const el = document.createElement("footer");
    el.className = "site-footer";
    el.innerHTML = `
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <a class="brand" href="index.html"><span class="brand__mark" data-samurai></span><span class="brand__text"><span class="brand__name">Самурай</span><span class="brand__sub">барбершоп</span></span></a>
            <p class="footer-slogan">У нас нет цели, только путь…</p>
            <div class="socials">${MESSENGERS.map(([k, label, href]) => `<a class="social" href="${href}" target="_blank" rel="noopener" aria-label="${label}">${icon(k)}</a>`).join("")}</div>
          </div>
          <div><h4>Разделы</h4><ul>${NAV.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul></div>
          <div><h4>Услуги</h4><ul>${D.services.filter((s) => s.top).slice(0, 6).map((s) => `<li><a href="booking.html?service=${s.id}">${s.name}</a></li>`).join("")}</ul></div>
          <div><h4>Контакты</h4><ul>
            <li><a href="${C.phoneHref}">${C.phone}</a></li>
            <li>${C.address}</li>
            <li class="muted">${C.hours}</li>
            <li><a href="booking.html" class="red" data-goal="booking_cta_footer">Записаться онлайн →</a></li>
          </ul></div>
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} Барбершоп «Самурай», Краснодар</span><span>Цены на сайте не являются публичной офертой</span></div>
      </div>`;
    document.body.append(el);

    if (page !== "booking") {
      const cta = document.createElement("div");
      cta.className = "sticky-cta";
      cta.innerHTML = `<a class="btn" href="booking.html" data-goal="booking_cta_sticky"><i class="ti ti-calendar-event"></i>Записаться</a><a class="btn btn--ghost" href="${C.phoneHref}" aria-label="Позвонить"><i class="ti ti-phone"></i></a>`;
      document.body.append(cta);
      window.addEventListener("scroll", () => cta.classList.toggle("is-show", window.scrollY > 500), { passive: true });
    }
  }

  function toast(text, icon = "check") {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.innerHTML = `<i class="ti ti-${icon}"></i>${esc(text)}`;
    t.classList.add("is-show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("is-show"), 2600);
  }

  function reveal(root = document) {
    const els = $$(".reveal:not(.is-in)", root);
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -40px 0px" });
    els.forEach((e) => io.observe(e));
  }

  let lb = null;
  function lightbox(items, index) {
    if (!lb) {
      lb = document.createElement("div");
      lb.className = "lightbox";
      lb.setAttribute("role", "dialog");
      lb.setAttribute("aria-modal", "true");
      lb.innerHTML = `<img alt=""><button class="lb-close" aria-label="Закрыть"><i class="ti ti-x"></i></button><button class="lb-prev" aria-label="Назад"><i class="ti ti-chevron-left"></i></button><button class="lb-next" aria-label="Вперёд"><i class="ti ti-chevron-right"></i></button><div class="lb-count"></div>`;
      document.body.append(lb);
      lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
      $(".lb-close", lb).onclick = close;
      $(".lb-prev", lb).onclick = () => show(lb._i - 1);
      $(".lb-next", lb).onclick = () => show(lb._i + 1);
      document.addEventListener("keydown", (e) => {
        if (!lb.classList.contains("is-open")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") show(lb._i - 1);
        if (e.key === "ArrowRight") show(lb._i + 1);
      });
    }
    function show(i) {
      const n = lb._items.length;
      lb._i = (i + n) % n;
      const it = lb._items[lb._i];
      $("img", lb).src = it.src;
      $("img", lb).alt = it.caption || "";
      $(".lb-count", lb).textContent = `${lb._i + 1} / ${n}${it.caption ? " · " + it.caption : ""}`;
    }
    function close() { lb.classList.remove("is-open"); document.body.style.overflow = ""; }
    lb._items = items;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    show(index);
    window.track && window.track("gallery_open");
  }

  const svcById = (id) => D.services.find((s) => s.id === id);
  const catById = (id) => D.categories.find((c) => c.id === id);
  const priceHtml = (s) => `<span class="price">${s.from ? "<small>от</small>" : ""}${fmt(s.price)} ₽</span>`;

  function renderServiceCards(el) {
    el.innerHTML = D.services.filter((s) => s.top).map((s, i) => `
      <article class="svc-card reveal reveal-d${i % 3}">
        <div class="svc-card__top"><span class="svc-card__num">${pad(i + 1)} · ${catById(s.cat).name}</span></div>
        <h3 class="h3">${s.name}</h3>
        <p>${s.desc}</p>
        <div class="svc-card__foot">
          <div>${priceHtml(s)}</div>
          <a class="btn btn--sm btn--ghost" href="booking.html?service=${s.id}" data-goal="booking_from_service">Записаться</a>
        </div>
      </article>`).join("");
  }

  function renderPriceList(el, nav) {
    el.innerHTML = D.categories.map((c) => `
      <section class="price-group reveal" id="cat-${c.id}">
        <div class="price-group__head"><span class="kanji">${c.kanji}</span><h2 class="h3" style="font-size:clamp(28px,3vw,44px)">${c.name}</h2></div>
        ${D.services.filter((s) => s.cat === c.id).map((s) => `
          <div class="price-row">
            <div><div class="price-row__name">${s.name}</div><div class="price-row__desc">${s.desc}</div></div>
            ${priceHtml(s)}
            <a class="btn btn--sm" href="booking.html?service=${s.id}" data-goal="booking_from_price">Записаться</a>
          </div>`).join("")}
      </section>`).join("");
    if (nav) {
      nav.innerHTML = D.categories.map((c, i) => `<a href="#cat-${c.id}"${i === 0 ? ' class="is-active"' : ""}>${c.name}</a>`).join("") +
        `<p class="note">Итоговая стоимость «от» зависит от длины и густоты волос — мастер озвучит её до начала работы.</p>`;
      const links = $$("a", nav);
      const io = new IntersectionObserver((en) => en.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
      }), { rootMargin: "-30% 0px -60% 0px" });
      $$(".price-group", el).forEach((g) => io.observe(g));
    }
  }

  const placeholder = (m) => `<div class="ph"><span class="ph__mark" data-samurai></span><span class="ph__kanji kanji">${m.kanji}</span><span class="ph__label"><i class="ti ti-camera"></i>Фото скоро</span></div>`;
  const sk = (w, h = 12) => `<span class="sk" style="width:${w};height:${h}px"></span>`;

  function renderMasters(el) {
    el.innerHTML = D.masters.map((m, i) => {
      const nf = Slots.nextFree(m.id);
      const next = nf ? `Ближайшее окно: ${Slots.dayLabel(nf.key)} в ${idxToTime(nf.start)}` : "Окна уточняйте по телефону";
      return `
      <article class="master reveal reveal-d${i}">
        <div class="master__photo">${placeholder(m)}</div>
        <div class="master__body">
          ${sk("38%", 10)}
          <h3 class="master__name">${m.name}</h3>
          <div class="sk-lines">${sk("100%")}${sk("94%")}${sk("72%")}</div>
          <div class="tags">${sk("92px", 30)}${sk("120px", 30)}${sk("76px", 30)}</div>
          <p class="master__soon">Описание мастера появится позже</p>
          <span class="master__next"><span class="dot"></span>${next}</span>
          <div class="master__actions">
            <a class="btn" href="booking.html?master=${m.id}" data-goal="booking_from_master">Записаться к мастеру</a>
            <a class="btn btn--ghost" href="reviews.html?master=${m.id}">Отзывы</a>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function reviewHtml(r, i) {
    const m = D.masters.find((x) => x.id === r.master);
    const initials = r.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return `
      <article class="review reveal reveal-d${i % 3}" data-master="${r.master || ""}">
        <div class="review__top">
          <span class="avatar">${esc(initials)}</span>
          <span class="review__who"><b>${esc(r.name)}</b><span>${r.date}</span></span>
          <span class="review__src">${r.src}</span>
        </div>
        <span class="stars">★★★★★</span>
        <p>${esc(r.text)}</p>
        ${m ? `<span class="review__master">Мастер: ${m.name}</span>` : ""}
      </article>`;
  }

  function renderReviews(el, limit) {
    const list = limit ? D.reviews.slice(0, limit) : D.reviews;
    el.innerHTML = list.map(reviewHtml).join("");
  }

  function renderWorks(el, limit) {
    const items = D.photos.filter((p) => p.cat === "works").slice(0, limit || 99);
    el.innerHTML = items.map((p, i) => `<a href="${p.src}" data-i="${i}" aria-label="Открыть фото: ${p.caption}"><img src="${p.src}" alt="${p.caption}" loading="lazy"></a>`).join("");
    el.addEventListener("click", (e) => {
      const a = e.target.closest("a"); if (!a) return;
      e.preventDefault(); lightbox(items, +a.dataset.i);
    });
  }

  function renderGallery(el) {
    el.innerHTML = D.photos.map((p, i) => `
      <a href="${p.src}" class="reveal reveal-d${i % 3}" data-i="${i}" aria-label="Открыть фото: ${p.caption}">
        <img src="${p.src}" alt="${p.caption}" loading="lazy"><figcaption>${p.caption}</figcaption>
      </a>`).join("");
    el.addEventListener("click", (e) => {
      const a = e.target.closest("a"); if (!a) return;
      e.preventDefault();
      lightbox(D.photos, +a.dataset.i);
    });
  }

  function renderReviewsPage(el, filters) {
    const cats = [["all", "Все отзывы"], ...D.masters.map((m) => [m.id, m.name])];
    const qs = new URLSearchParams(location.search).get("master");
    let current = cats.some((c) => c[0] === qs) ? qs : "all";
    const draw = () => {
      const list = D.reviews.filter((r) => current === "all" || r.master === current);
      el.innerHTML = list.map(reviewHtml).join("");
      reveal(el);
    };
    filters.innerHTML = cats.map(([id, t]) => `<button class="chip${id === current ? " is-active" : ""}" data-f="${id}" type="button">${t}</button>`).join("");
    filters.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      current = b.dataset.f;
      $$(".chip", filters).forEach((c) => c.classList.toggle("is-active", c === b));
      draw();
    });
    draw();
  }

  function fillContacts() {
    $$("[data-c]").forEach((el) => {
      const k = el.dataset.c;
      if (el.tagName === "A") {
        const map = { phone: C.phoneHref, whatsapp: C.whatsapp, telegram: C.telegram, max: C.max, yandex: C.yandexMap, gis: C.gisMap };
        if (map[k]) el.href = map[k];
        if (k === "phone" && !el.children.length) el.textContent = C.phone;
      } else if (C[k]) el.textContent = C[k];
    });
    $$("[data-messengers]").forEach((el) => { el.innerHTML = messengerButtons(); });
    $$("[data-map]").forEach((el) => {
      el.innerHTML = `<iframe src="${C.mapEmbed}" title="Барбершоп Самурай на карте" loading="lazy" allowfullscreen></iframe>
        <div class="map__links"><a href="${C.yandexMap}" target="_blank" rel="noopener" data-goal="route_yandex"><i class="ti ti-route"></i>Яндекс Карты</a><a href="${C.gisMap}" target="_blank" rel="noopener" data-goal="route_2gis"><i class="ti ti-map-2"></i>2GIS</a></div>`;
    });
  }

  window.SamuraiUI = { $, $$, fmt, plural, durText, esc, store, toast, reveal, paintSamurai, samuraiReady, Slots, svcById, catById, placeholder, sk };

  rail();
  header();
  footer();
  fillContacts();

  const r = (sel, fn) => { const el = $(sel); if (el) fn(el); };
  r("[data-render=services-top]", renderServiceCards);
  r("[data-render=price-list]", (el) => renderPriceList(el, $("[data-render=price-nav]")));
  r("[data-render=masters]", renderMasters);
  r("[data-render=reviews-top]", (el) => renderReviews(el, 6));
  r("[data-render=works]", (el) => renderWorks(el, +el.dataset.limit || 0));
  r("[data-render=gallery]", renderGallery);
  r("[data-render=reviews-all]", (el) => renderReviewsPage(el, $("[data-render=review-filters]")));

  samuraiReady.then(() => paintSamurai());
  reveal();
})();
