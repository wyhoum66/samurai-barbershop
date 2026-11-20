(function () {
  const D = window.SAMURAI;
  const { $, $$, fmt, esc, toast, Slots, svcById, paintSamurai, samuraiReady, placeholder, sk } = window.SamuraiUI;
  const root = $("#booking");
  if (!root) return;

  const DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const state = { step: 1, services: new Set(), master: null, date: null, start: null, assigned: null };
  let started = false;

  const qs = new URLSearchParams(location.search);
  if (svcById(qs.get("service") || "")) state.services.add(qs.get("service"));
  if (qs.get("master") === "any" || D.masters.some((m) => m.id === qs.get("master"))) state.master = qs.get("master");

  const selected = () => [...state.services].map(svcById);
  const totalDur = () => selected().reduce((a, s) => a + s.dur, 0);
  const totalPrice = () => selected().reduce((a, s) => a + s.price, 0);
  const anyFrom = () => selected().some((s) => s.from);
  const need = () => Math.max(1, Math.ceil(totalDur() / Slots.STEP));
  const masterName = (id) => id === "any" ? "Любой свободный" : (D.masters.find((m) => m.id === id) || {}).name;

  function go(step) {
    state.step = step;
    $$(".step-panel", root).forEach((p) => p.classList.toggle("is-active", +p.dataset.step === step));
    $$(".step-tab", root).forEach((t) => {
      const n = +t.dataset.step;
      t.classList.toggle("is-current", n === step);
      t.classList.toggle("is-done", n < step);
      t.disabled = n > step || step === 5;
    });
    $(".steps", root).style.display = step === 5 ? "none" : "";
    $(".summary", root).style.display = step === 5 ? "none" : "";
    root.classList.toggle("is-done", step === 5);
    if (step === 3) drawDates();
    if (step <= 4) window.track && window.track("booking_step_" + step);
    const top = root.getBoundingClientRect().top + window.scrollY - 100;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    updateSummary();
  }

  function drawServices() {
    $("#svc-list").innerHTML = D.categories.map((c) => `
      <div class="pick-group">
        <h4>${c.name}</h4>
        <div class="pick-list">
          ${D.services.filter((s) => s.cat === c.id).map((s) => `
            <label class="pick">
              <input type="checkbox" value="${s.id}"${state.services.has(s.id) ? " checked" : ""}>
              <span class="pick__box"><i class="ti ti-check"></i></span>
              <span class="pick__name">${s.name}<span class="pick__dur">${s.desc}</span></span>
              <span class="pick__price">${s.from ? "от " : ""}${fmt(s.price)} ₽</span>
            </label>`).join("")}
        </div>
      </div>`).join("");
    $("#svc-list").addEventListener("change", (e) => {
      if (!e.target.matches("input")) return;
      e.target.checked ? state.services.add(e.target.value) : state.services.delete(e.target.value);
      if (!started) { started = true; window.track && window.track("booking_start"); }
      state.start = null; state.assigned = null;
      updateSummary();
    });
  }

  function drawMasters() {
    const any = `
      <button type="button" class="barber${state.master === "any" ? " is-selected" : ""}" data-id="any">
        <span class="barber__img"><span class="barber__any" data-samurai></span><span class="barber__check"><i class="ti ti-check"></i></span></span>
        <span class="barber__body"><small>Быстрее всего</small><b>Любой мастер</b><span>Подберём того, кто свободен в удобное время</span></span>
      </button>`;
    $("#master-list").innerHTML = any + D.masters.map((m) => {
      const nf = Slots.nextFree(m.id, need());
      return `
      <button type="button" class="barber${state.master === m.id ? " is-selected" : ""}" data-id="${m.id}">
        <span class="barber__img">${placeholder(m)}<span class="barber__check"><i class="ti ti-check"></i></span></span>
        <span class="barber__body">${sk("44%", 9)}<b>${m.name}</b>
          <span>${nf ? `Ближайшее окно: ${Slots.dayLabel(nf.key)}, ${Slots.idxToTime(nf.start)}` : "Нет окон на 2 недели"}</span>
        </span>
      </button>`;
    }).join("");
    samuraiReady.then(() => paintSamurai($("#master-list")));
  }

  function freeFor(key) {
    const n = need();
    if (state.master && state.master !== "any") return Slots.freeStarts(state.master, key, n).map((s) => ({ s, m: state.master }));
    const map = new Map();
    D.masters.slice().sort((a, b) => a.busy - b.busy).forEach((m) => Slots.freeStarts(m.id, key, n).forEach((s) => { if (!map.has(s)) map.set(s, m.id); }));
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([s, m]) => ({ s, m }));
  }

  function drawDates() {
    const box = $("#date-list");
    const d = new Date();
    if (Slots.minStart(Slots.dayKey(d)) + need() > Slots.SLOTS) d.setDate(d.getDate() + 1);
    const days = [];
    for (let i = 0; i < 14; i++) { days.push(Slots.dayKey(d)); d.setDate(d.getDate() + 1); }
    const counts = Object.fromEntries(days.map((k) => [k, freeFor(k).length]));
    if (!state.date || !days.includes(state.date) || !counts[state.date]) state.date = days.find((k) => counts[k]) || days[0];
    const today = Slots.dayKey(new Date());
    box.innerHTML = days.map((k) => {
      const dt = Slots.keyToDate(k);
      const label = k === today ? "Сегодня" : Slots.dayLabel(k) === "завтра" ? "Завтра" : dt.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
      return `<button type="button" class="date${k === state.date ? " is-selected" : ""}${counts[k] ? "" : " is-full"}" data-k="${k}"${counts[k] ? "" : " disabled"}>
        <small>${DOW[dt.getDay()]}</small><b>${dt.getDate()}</b><em>${counts[k] ? label : "нет мест"}</em></button>`;
    }).join("");
    drawSlots();
  }

  function drawSlots() {
    const box = $("#slot-list");
    const free = freeFor(state.date);
    const freeSet = new Map(free.map((f) => [f.s, f.m]));
    const minS = Slots.minStart(state.date);
    const n = need();
    $("#slot-caption").textContent = `${Slots.dayLabel(state.date)[0].toUpperCase() + Slots.dayLabel(state.date).slice(1)} · ${masterName(state.master)}`;
    if (!free.length) { box.innerHTML = `<div class="empty">На эту дату свободных окон нет — выберите другой день.</div>`; return; }
    const parts = [["Утро", 0, 4], ["День", 4, 12], ["Вечер", 12, Slots.SLOTS]];
    box.innerHTML = parts.map(([title, a, b]) => {
      const items = [];
      for (let s = Math.max(a, minS); s < b && s + n <= Slots.SLOTS; s++) {
        const m = freeSet.get(s);
        const sel = state.start === s ? " is-selected" : "";
        const sub = state.master === "any" && m ? `<small>${masterName(m)}</small>` : "";
        items.push(`<button type="button" class="slot${sel}" data-s="${s}"${m ? ` data-m="${m}"` : " disabled"} aria-label="${Slots.idxToTime(s)}${m ? "" : ", занято"}">${Slots.idxToTime(s)}${sub}</button>`);
      }
      return items.length ? `<div class="slot-section"><h5>${title}</h5><div class="slots">${items.join("")}</div></div>` : "";
    }).join("");
  }

  function updateSummary() {
    const sel = selected();
    $("#sum-services").innerHTML = sel.length
      ? `<ul>${sel.map((s) => `<li><span>${s.name}</span><span>${s.from ? "от " : ""}${fmt(s.price)} ₽</span></li>`).join("")}</ul>`
      : `<span class="sum-empty">Не выбраны</span>`;
    const mName = state.assigned && state.master === "any" ? `${masterName(state.assigned)} (любой свободный)` : masterName(state.master);
    $("#sum-master").innerHTML = state.master ? esc(mName) : `<span class="sum-empty">Не выбран</span>`;
    $("#sum-time").innerHTML = state.start != null
      ? `${Slots.keyToDate(state.date).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}, ${Slots.idxToTime(state.start)}–${endTime()}`
      : `<span class="sum-empty">Не выбрано</span>`;
    $("#sum-total").textContent = sel.length ? (anyFrom() ? "от " : "") + fmt(totalPrice()) + " ₽" : "0 ₽";
    $("#next-1").disabled = !sel.length;
    $("#next-2").disabled = !state.master;
    $("#next-3").disabled = state.start == null;
    $("#sum-mobile-total").textContent = $("#sum-total").textContent;
  }

  function endTime() {
    const m = D.contacts.open * 60 + state.start * Slots.STEP + totalDur();
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }

  function maskPhone(v) {
    let d = v.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    let out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 4) out += ")";
    if (d.length > 4) out += " " + d.slice(4, 7);
    if (d.length > 7) out += "-" + d.slice(7, 9);
    if (d.length > 9) out += "-" + d.slice(9, 11);
    return out;
  }

  function validate() {
    let ok = true;
    const set = (id, msg) => {
      const f = $("#" + id).closest(".field");
      f.classList.toggle("has-error", !!msg);
      $(".field__err", f).textContent = msg || "";
      if (msg) ok = false;
    };
    set("f-name", $("#f-name").value.trim().length < 2 ? "Как к вам обращаться?" : "");
    set("f-phone", $("#f-phone").value.replace(/\D/g, "").length !== 11 ? "Введите номер полностью" : "");
    const agree = $("#f-agree");
    $("#agree-err").textContent = agree.checked ? "" : "Нужно согласие на обработку данных";
    if (!agree.checked) ok = false;
    return ok;
  }

  function confirm() {
    if (!validate()) return;
    const master = state.master === "any" ? state.assigned : state.master;
    if (!Slots.freeStarts(master, state.date, need()).includes(state.start)) {
      toast("Это окно только что заняли — выберите другое", "alert-triangle");
      state.start = null; go(3); return;
    }
    const b = {
      id: Date.now().toString(36),
      master, date: state.date, start: state.start, slots: need(),
      services: [...state.services], total: totalPrice(), from: anyFrom(), dur: totalDur(),
      name: $("#f-name").value.trim(), phone: $("#f-phone").value, comment: $("#f-comment").value.trim(),
      created: new Date().toISOString()
    };
    const list = Slots.bookings(); list.push(b); Slots.saveBookings(list);
    window.track && window.track("booking_done", { master, services: b.services.join(","), total: b.total });
    drawDone(b);
    go(5);
  }

  function drawDone(b) {
    const dt = Slots.keyToDate(b.date);
    $("#done-name").textContent = b.name.split(" ")[0];
    $("#ticket").innerHTML = `
      <div class="ticket__main">
        <div><small>Мастер</small><b>${esc(masterName(b.master))}</b></div>
        <div><small>Услуги</small><b>${b.services.map((id) => svcById(id).name).join(", ")}</b></div>
        <div><small>Стоимость</small><b>${b.from ? "от " : ""}${fmt(b.total)} ₽</b></div>
        <div><small>Адрес</small><b>${D.contacts.address}, ${D.contacts.addressNote.split(" · ")[0]}</b></div>
      </div>
      <div class="ticket__side"><span>${DOW[dt.getDay()]}, ${dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span><b>${Slots.idxToTime(b.start)}</b><span>№ ${b.id.toUpperCase()}</span></div>`;
    $("#ics").onclick = () => downloadIcs(b);
  }

  function downloadIcs(b) {
    const dt = Slots.keyToDate(b.date);
    const startMin = D.contacts.open * 60 + b.start * Slots.STEP;
    const s = new Date(dt); s.setHours(0, startMin, 0, 0);
    const e = new Date(s.getTime() + b.dur * 60000);
    const f = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00";
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Samurai//RU", "BEGIN:VEVENT", "UID:" + b.id + "@samurai", "DTSTART:" + f(s), "DTEND:" + f(e),
      "SUMMARY:Барбершоп «Самурай» — " + masterName(b.master), "LOCATION:Краснодар, " + D.contacts.address, "DESCRIPTION:" + b.services.map((id) => svcById(id).name).join(", "), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "samurai-zapis.ics";
    a.click();
    window.track && window.track("booking_ics");
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.matches(".step-tab") && !t.disabled) go(+t.dataset.step);
    if (t.id === "next-1") { drawMasters(); go(2); }
    if (t.id === "next-2") go(3);
    if (t.id === "next-3") go(4);
    if (t.dataset.back) go(+t.dataset.back);
    if (t.matches(".barber")) {
      state.master = t.dataset.id; state.start = null; state.assigned = null;
      $$(".barber", root).forEach((b) => b.classList.toggle("is-selected", b === t));
      updateSummary();
    }
    if (t.matches(".date") && !t.disabled) {
      state.date = t.dataset.k; state.start = null; state.assigned = null;
      $$(".date", root).forEach((b) => b.classList.toggle("is-selected", b === t));
      drawSlots(); updateSummary();
    }
    if (t.matches(".slot") && !t.disabled) {
      state.start = +t.dataset.s; state.assigned = t.dataset.m;
      $$(".slot", root).forEach((b) => b.classList.toggle("is-selected", b === t));
      updateSummary();
    }
    if (t.id === "confirm") confirm();
    if (t.id === "again") {
      state.services.clear(); state.master = null; state.start = null; state.assigned = null;
      $("#booking-form").reset();
      drawServices(); go(1);
    }
    if (t.id === "sum-toggle") $(".summary", root).classList.toggle("is-open");
  });

  $("#f-phone").addEventListener("input", (e) => { e.target.value = maskPhone(e.target.value); });
  $("#f-phone").addEventListener("focus", (e) => { if (!e.target.value) e.target.value = "+7 ("; });
  $$("#booking-form input").forEach((i) => i.addEventListener("input", () => {
    const f = i.closest(".field"); if (f) { f.classList.remove("has-error"); $(".field__err", f).textContent = ""; }
    if (i.id === "f-agree") $("#agree-err").textContent = "";
  }));
  $("#booking-form").addEventListener("submit", (e) => { e.preventDefault(); confirm(); });

  drawServices();
  drawMasters();
  go(state.services.size && state.master ? 3 : state.services.size ? 2 : 1);
})();
