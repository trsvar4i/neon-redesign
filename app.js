/* Логика главной страницы: подбор кабинок, бронь, игры, FAQ. */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ') + ' сум';
const plural = (n, one, few, many) => {
  const a = n % 100, b = n % 10;
  if (a > 10 && a < 20) return many;
  return b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
const srcset = (path) => [480, 800, 1200].map((w) => `${photo(path, w)} ${w}w`).join(', ');
const branchOf = (id) => BRANCHES.find((b) => b.id === id);
const cabinById = (id) => CABINS.find((c) => c.id === id);

const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;

const MAX_GUESTS = Math.max(...CABINS.map((c) => c.cap));
/* guests: 0 — число гостей не указано, показываем все комнаты;
   location — филиал (ключ из ADDRESSES), branch — категория внутри филиала */
const state = { guests: 0, location: null, branch: 'all', karaoke: false, showAll: false };

/* ——— Подбор кабинок ——— */
function matches() {
  return CABINS.filter((c) =>
    c.cap >= state.guests &&
    (!state.location || branchOf(c.b).address === state.location) &&
    (state.branch === 'all' || c.b === state.branch) &&
    (!state.karaoke || c.karaoke)
  ).sort((a, b) => BRANCHES.indexOf(branchOf(a.b)) - BRANCHES.indexOf(branchOf(b.b)) || a.n - b.n);
}

const PAGE = 8;
const ICONS = {
  guests: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.500-6s6 2 6.500 6"/><path d="M16 4.800a3.500 3.500 0 0 1 0 6.400"/><path d="M18.500 14.500c1.700.8 2.700 2.600 3 5.500"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0"/><path d="M12 18v3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  chevron: '<svg class="cselect-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  check: '<svg class="cselect-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
};
const guestsText = (c) => 'до ' + c.cap + ' ' + plural(c.cap, 'гостя', 'гостей', 'гостей');
/* Цена с гостя считается по числу гостей из подбора; для одного гостя она равна цене кабинки */
const perGuest = (c) => (state.guests > 1
  ? `≈ ${money(Math.round(c.price / state.guests / 1000) * 1000)} с гостя, если вас ${state.guests}`
  : '');
const priceNumber = (c) => money(c.price).replace(' сум', '');

function cabinCard(c) {
  const label = esc(branchOf(c.b).name + ', ' + c.title);
  const slides = c.photos.map((p, i) => '<button class="room-slide" type="button" data-open="' + c.id + '" data-start="' + i + '"' +
    (i ? ' tabindex="-1"' : '') + ' aria-label="' + label + ': фото и детали">' +
    '<img src="' + photo(p, 800) + '" srcset="' + srcset(p) + '" sizes="(max-width: 760px) 100vw, 50vw" alt="" loading="lazy" draggable="false"></button>').join('');
  const bars = c.photos.length > 1
    ? '<div class="room-bars" aria-hidden="true">' + c.photos.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('') + '</div>'
    : '';
  return '<article class="room">' +
    '<div class="room-media"><div class="room-track">' + slides + '</div>' + bars + '</div>' +
    '<div class="room-body">' +
      '<div class="room-title">' +
        '<h3>' + (c.hall ? esc(c.title) : 'Room <em>' + c.n + '</em>') + '</h3>' +
        '<p>' + branchOf(c.b).name + '</p>' +
      '</div>' +
      '<div class="room-cost">' +
        '<p><strong>' + priceNumber(c) + '</strong> сум/час</p>' +
        (state.guests > 1 ? '<p class="room-per">' + perGuest(c) + '</p>' : '') +
      '</div>' +
      '<div class="room-foot">' +
        '<ul class="room-specs">' +
          '<li>' + ICONS.guests + guestsText(c) + '</li>' +
          (c.karaoke ? '<li class="room-karaoke">' + ICONS.mic + 'Караоке</li>' : '') +
          (c.hall ? '<li>Диван с PS5</li>' : '') +
        '</ul>' +
        '<button class="room-book" type="button" data-book="' + c.id + '">Забронировать' + ICONS.arrow + '</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function emptyHint() {
  if (!state.karaoke) return '';
  const luxuryOnly = state.location === 'shevchenko' || (state.branch !== 'all' && state.branch !== 'luxury');
  return luxuryOnly ? 'Караоке есть только в кабинках Luxury на Авлиё-Ота.' : 'Караоке-кабинки вмещают до 8 гостей.';
}

let lastShownKey = null;

function renderFinder() {
  const found = matches();
  const shown = state.showAll ? found : found.slice(0, PAGE);
  /* Карточки появляются заново только когда меняется сам набор комнат, а не подпись с ценой */
  const shownKey = shown.map((c) => c.id).join();
  const grid = $('#cabin-grid');
  grid.classList.toggle('animate-cards', shownKey !== lastShownKey);
  lastShownKey = shownKey;
  grid.innerHTML = shown.length
    ? shown.map(cabinCard).join('')
    : `<div class="empty"><p>Под такие условия кабинок нет. ${emptyHint()}</p>
       <button class="btn btn-ghost" type="button" id="reset-filters">Сбросить фильтры</button></div>`;

  $$('.room', grid).forEach((room, i) => room.style.setProperty('--i', i));

  const n = found.length;
  $('#result-count').textContent = n
    ? `${plural(n, 'Подходит', 'Подходят', 'Подходят')} ${n} ${plural(n, 'кабинка', 'кабинки', 'кабинок')}${state.guests ? '' : '. Укажите число гостей, и мы посчитаем цену с человека'}`
    : 'Ничего не найдено';

  const more = $('#show-more');
  more.hidden = state.showAll || n <= PAGE;
  more.textContent = `Показать ещё ${n - PAGE}`;

  $$('[data-guests]').forEach((el) => { el.textContent = state.guests || '—'; });
  $$('[data-karaoke]').forEach((el) => { el.checked = state.karaoke; });
  $$('#location-filter button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.location === state.location));
  const categories = state.location ? BRANCHES.filter((b) => b.address === state.location) : [];
  const row = $('#category-row');
  row.hidden = categories.length < 2;
  if (!row.hidden) {
    $('#branch-filter').innerHTML = categories
      .map((b) => `<button type="button" data-branch="${b.id}" aria-pressed="${b.id === state.branch}">${b.name}</button>`).join('');
  }
  $('[data-quick-label]').textContent = n
    ? `Показать ${n} ${plural(n, 'кабинку', 'кабинки', 'кабинок')}`
    : 'Показать кабинки';
  syncStepButtons();
}

function syncStepButtons() {
  $$('[data-step="-1"]').forEach((b) => { b.disabled = state.guests <= 0; });
  $$('[data-step="1"]').forEach((b) => { b.disabled = state.guests >= MAX_GUESTS; });
}

const hasKaraoke = (branch) => CABINS.some((c) => c.b === branch.id && c.karaoke);

function setFilters(next) {
  Object.assign(state, next, { showAll: false });
  /* В филиале с несколькими категориями одна выбрана всегда, начиная с первой */
  if ('location' in next) {
    const categories = BRANCHES.filter((b) => b.address === state.location);
    const first = state.karaoke ? categories.find(hasKaraoke) : categories[0];
    state.branch = categories.length > 1 && first ? first.id : 'all';
  }
  if (next.karaoke && state.branch !== 'all' && !hasKaraoke(branchOf(state.branch))) {
    state.branch = BRANCHES.find((b) => b.address === state.location && hasKaraoke(b))?.id || state.branch;
  }
  if (next.branch && next.branch !== 'all') {
    state.location = branchOf(next.branch).address;
    /* В филиале с одной категорией выбирать нечего: показываем все его кабинки */
    state.branch = BRANCHES.filter((b) => b.address === state.location).length > 1 ? next.branch : 'all';
  }
  renderFinder();
}

function goToCabins() {
  $('#cabins').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/* ——— Закрытие окон: сначала анимация ухода, потом само закрытие ——— */
function closeDialog(dialog) {
  if (!dialog.open || dialog.classList.contains('closing')) return;
  if (!motionOK()) { dialog.close(); return; }
  dialog.classList.add('closing');
  setTimeout(() => {
    dialog.close();
    dialog.classList.remove('closing');
  }, 180);
}

/* ——— Диалог кабинки ——— */
function openCabin(id, start = 0) {
  const c = cabinById(id);
  const b = branchOf(c.b);
  const addr = ADDRESSES[b.address];
  $('#cabin-dialog-body').innerHTML = `
    <div class="gallery">
      <img class="gallery-main" id="gallery-main" src="${photo(c.photos[start], 1200)}" alt="${esc(c.title)}, ${b.name}, фото ${start + 1} из ${c.photos.length}">
      ${c.photos.length > 1 ? `<div class="gallery-thumbs">${c.photos.map((p, i) => `
        <button type="button" data-photo="${i}" aria-label="Фото ${i + 1}" aria-pressed="${i === start}"><img src="${photo(p, 240)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div class="cabin-detail">
      <p class="cabin-branch mono">${b.name} · ${esc(addr.title)}</p>
      <h2 id="cabin-dialog-title">${esc(c.title)}</h2>
      <ul class="cabin-tags">
        <li>до ${c.cap} ${plural(c.cap, 'гостя', 'гостей', 'гостей')}</li>
        ${c.karaoke ? '<li class="tag-volt">караоке</li>' : ''}
        <li>PS5</li>
      </ul>
      ${c.hall ? '' : '<p class="cabin-included">В цену кабинки входит использование сервиса Allplay и настольные игры</p>'}
      <p class="cabin-price"><strong class="mono">${money(c.price)}</strong> <span>в час за всю кабинку</span></p>
      ${state.guests > 1 ? `<p class="cabin-included">${perGuest(c)}</p>` : ''}
      ${c.b === LUXURY_DEAL.branch ? `<p class="deal-note mono">Пн–чт, 10:00–15:00: ${money(c.price * LUXURY_DEAL.rate)} в час</p>` : ''}
      <button class="btn btn-volt btn-block" type="button" data-book="${c.id}">Забронировать</button>
    </div>`;
  const dlg = $('#cabin-dialog');
  dlg.dataset.cabin = id;
  dlg.showModal();
  dlg.scrollTop = 0;
}

/* ——— Бронь ———
   Рабочий день идёт с 10:00 до 06:00 следующего утра, поэтому дата в форме — это
   дата рабочего дня, а ночные слоты подписаны отдельно: «ночь на 7 ноября». */
const OPEN = 10 * 60;
const CLOSE = 30 * 60;
const STEP = 30;
const book = { cabin: '', date: '', time: OPEN + 8 * 60, hours: 2, guests: 4 };

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayLabel = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const clock = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

function operatingDay(now = new Date()) {
  return now.getHours() < 6 ? addDays(now, -1) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function minutesIntoOperatingDay(now = new Date()) {
  const h = now.getHours();
  return (h < 6 ? h + 24 : h) * 60 + now.getMinutes();
}

function availableSlots(dateISO) {
  const slots = [];
  const isToday = dateISO === toISO(operatingDay());
  const earliest = isToday ? minutesIntoOperatingDay() : 0;
  for (let m = OPEN; m <= CLOSE - 60; m += STEP) if (m >= earliest) slots.push(m);
  return slots;
}

function estimate(cabin, dateISO, start, hours) {
  const weekday = fromISO(dateISO).getDay();
  const dealOn = cabin.b === LUXURY_DEAL.branch && LUXURY_DEAL.days.includes(weekday);
  let total = 0, full = 0;
  for (let m = start; m < start + hours * 60; m += STEP) {
    const part = cabin.price / 2;
    full += part;
    total += dealOn && m >= LUXURY_DEAL.from && m < LUXURY_DEAL.to ? part * LUXURY_DEAL.rate : part;
  }
  return { total, full };
}

function fillCabinSelect() {
  const groups = BRANCHES.map((b) => `<optgroup label="${b.name} · ${ADDRESSES[b.address].title}">${CABINS.filter((c) => c.b === b.id).map((c) =>
    `<option value="${c.id}">${esc(c.title)}${c.karaoke ? ', караоке' : ''} · до ${c.cap} · ${money(c.price)}/час</option>`).join('')}</optgroup>`).join('');
  $('#b-cabin').innerHTML = `<option value="">Подберите за меня</option><option value="veranda">Столик на летней веранде</option>${groups}`;
}

function renderTime() {
  const slots = availableSlots(book.date);
  if (!slots.includes(book.time)) book.time = slots.find((m) => m >= book.time) ?? slots[slots.length - 1];
  const nextDay = dayLabel(addDays(fromISO(book.date), 1));
  const day = slots.filter((m) => m < 24 * 60);
  const night = slots.filter((m) => m >= 24 * 60);
  const opts = (list) => list.map((m) => `<option value="${m}"${m === book.time ? ' selected' : ''}>${clock(m)}</option>`).join('');
  $('#b-time').innerHTML =
    (day.length ? `<optgroup label="${dayLabel(fromISO(book.date))}">${opts(day)}</optgroup>` : '') +
    (night.length ? `<optgroup label="Ночь на ${nextDay}">${opts(night)}</optgroup>` : '');
}

function renderBooking() {
  const today = operatingDay();
  const hasSlotsToday = availableSlots(toISO(today)).length > 0;
  const todayBtn = $('#b-today'), tomorrowBtn = $('#b-tomorrow');
  todayBtn.textContent = 'Сегодня';
  tomorrowBtn.textContent = 'Завтра';
  todayBtn.disabled = !hasSlotsToday;
  todayBtn.setAttribute('aria-pressed', book.date === toISO(today));
  tomorrowBtn.setAttribute('aria-pressed', book.date === toISO(addDays(today, 1)));
  $('#b-date').min = toISO(hasSlotsToday ? today : addDays(today, 1));
  $('#b-date').value = book.date;
  $('#b-cabin').value = book.cabin;

  renderTime();
  customSelects.forEach(refreshSelect);

  const maxHours = Math.max(1, Math.floor((CLOSE - book.time) / 60));
  book.hours = Math.min(book.hours, maxHours);
  $('#b-hours').textContent = book.hours;
  $('#b-hours-minus').disabled = book.hours <= 1;
  $('#b-hours-plus').disabled = book.hours >= maxHours;
  $('#b-guests').textContent = book.guests;
  $('#b-guests-minus').disabled = book.guests <= 1;
  $('#b-guests-plus').disabled = book.guests >= 30;

  const cabin = cabinById(book.cabin);
  const warn = $('#b-capacity');
  warn.hidden = !(cabin && book.guests > cabin.cap);
  if (cabin) warn.textContent = `Эта кабинка рассчитана на ${cabin.cap} ${plural(cabin.cap, 'гостя', 'гостей', 'гостей')}. Менеджер предложит вариант побольше.`;

  const end = clock(book.time + book.hours * 60);
  const box = $('#b-total');
  if (cabin) {
    const { total, full } = estimate(cabin, book.date, book.time, book.hours);
    box.innerHTML = `
      <div><span class="total-label">Предварительно за ${book.hours} ${plural(book.hours, 'час', 'часа', 'часов')}, ${clock(book.time)}–${end}</span>
      ${total < full ? `<span class="total-deal mono">Скидка Luxury: −${money(full - total)}</span>` : ''}</div>
      <strong class="mono">${money(total)}</strong>`;
  } else {
    box.innerHTML = `<div><span class="total-label">${clock(book.time)}–${end}. ${book.cabin === 'veranda' ? 'На веранде депозит — один кальян.' : 'Менеджер подберёт кабинку и назовёт цену.'}</span></div>`;
  }
}

function openBooking(target) {
  const today = operatingDay();
  const hasSlotsToday = availableSlots(toISO(today)).length > 0;
  if (!book.date) book.date = toISO(hasSlotsToday ? today : addDays(today, 1));
  book.guests = state.guests || 2;

  if (target === 'luxury-deal') {
    let d = hasSlotsToday ? today : addDays(today, 1);
    while (!LUXURY_DEAL.days.includes(d.getDay()) || (toISO(d) === toISO(today) && minutesIntoOperatingDay() >= LUXURY_DEAL.to - 60)) d = addDays(d, 1);
    book.date = toISO(d);
    book.time = Math.max(OPEN + 60, toISO(d) === toISO(today) ? Math.ceil(minutesIntoOperatingDay() / STEP) * STEP : 0);
    book.cabin = 'luxury-2';
    book.hours = 2;
  } else if (target) {
    book.cabin = target;
  }

  $('#book-form-view').hidden = false;
  $('#book-done').hidden = true;
  $('#b-send-err').hidden = true;
  $('#book-title').textContent = book.cabin === 'veranda' ? 'Бронь столика на веранде' : 'Бронь кабинки';
  renderBooking();
  $('#cabin-dialog').close();
  $('#book-dialog').showModal();
  $('#book-dialog').scrollTop = 0;
}

function formatPhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (!digits.startsWith('998')) digits = '998' + digits.replace(/^998/, '');
  digits = digits.slice(0, 12);
  const parts = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 8), digits.slice(8, 10), digits.slice(10, 12)].filter(Boolean);
  return '+' + parts.join(' ') + (digits.length === 3 ? ' ' : '');
}

function validate() {
  const name = $('#b-name'), phone = $('#b-phone');
  const nameOk = name.value.trim().length > 0;
  const phoneOk = phone.value.replace(/\D/g, '').length === 12;
  name.setAttribute('aria-invalid', !nameOk);
  phone.setAttribute('aria-invalid', !phoneOk);
  $('#b-name-err').hidden = nameOk;
  $('#b-phone-err').hidden = phoneOk;
  const terms = $('#b-terms');
  $('#b-terms-err').hidden = terms.checked;
  terms.setAttribute('aria-invalid', !terms.checked);
  if (!nameOk) name.focus();
  else if (!phoneOk) phone.focus();
  else if (!terms.checked) terms.focus();
  return nameOk && phoneOk && terms.checked;
}

async function submitBooking(e) {
  e.preventDefault();
  if (!validate()) return;

  const cabin = cabinById(book.cabin);
  const place = cabin ? `${branchOf(cabin.b).name}, ${cabin.title}` : book.cabin === 'veranda' ? 'Столик на веранде' : 'Подобрать кабинку';
  const night = book.time >= 24 * 60;
  const range = `${clock(book.time)}–${clock(book.time + book.hours * 60)}`;
  const when = night
    ? `Ночь на ${dayLabel(addDays(fromISO(book.date), 1))}, ${range}`
    : `${dayLabel(fromISO(book.date))}, ${range}`;
  const payload = {
    place, date: book.date, start: clock(book.time), hours: book.hours, guests: book.guests,
    name: $('#b-name').value.trim(), phone: $('#b-phone').value.trim(), termsAccepted: true,
    estimate: cabin ? estimate(cabin, book.date, book.time, book.hours).total : null,
  };

  if (CONFIG.bookingEndpoint) {
    const btn = $('#b-submit');
    btn.disabled = true;
    try {
      const res = await fetch(CONFIG.bookingEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(res.status);
    } catch {
      const err = $('#b-send-err');
      err.textContent = `Не получилось отправить заявку. Позвоните нам: ${CONFIG.phone}`;
      err.hidden = false;
      return;
    } finally {
      btn.disabled = false;
    }
    $('.demo-note').hidden = true;
  }

  $('#done-list').innerHTML = [['Где', place], ['Когда', when], ['Гостей', book.guests], ['Имя', payload.name], ['Телефон', payload.phone]]
    .concat(payload.estimate ? [['Предварительно', money(payload.estimate)]] : [])
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#book-form-view').hidden = true;
  const done = $('#book-done');
  done.hidden = false;
  done.focus();
}

/* ——— Статичные блоки ——— */
function renderStatic() {
  const inAddress = (key) => BRANCHES.filter((b) => b.address === key);
  $('#location-filter').innerHTML = Object.entries(ADDRESSES).map(([key, addr]) => `
    <button type="button" data-location="${key}"><strong><span class="loc-full">${esc(addr.title)}</span><span class="loc-short">${esc(addr.shortTitle)}</span></strong><span class="loc-hint">${esc(addr.hint)}</span></button>`).join('');

  const branchRow = (b) => {
    const list = CABINS.filter((c) => c.b === b.id);
    const min = Math.min(...list.map((c) => c.price));
    return `
      <article class="branch" id="${b.id}">
        <div class="branch-photo"><img src="${photo(b.cover, 800)}" srcset="${srcset(b.cover)}" sizes="(max-width: 800px) 100vw, 45vw" alt="Интерьер кабинки NEON ${b.name}" loading="lazy"></div>
        <div class="branch-copy">
          <h4>${b.name}</h4>
          <p class="branch-pitch">${b.pitch}</p>
          <p>${b.about}</p>
          <dl class="branch-facts mono">
            <div><dt>Цена</dt><dd>от ${money(min)}/час</dd></div>
            <div><dt>Вместимость</dt><dd>до ${Math.max(...list.map((c) => c.cap))} гостей</dd></div>
          </dl>
          <button class="btn btn-ghost" type="button" data-branch-link="${b.id}">Кабинки ${b.name}</button>
        </div>
      </article>`;
  };
  $('#branch-list').innerHTML = Object.entries(ADDRESSES).map(([key, addr]) => `
    <div class="branch-group">
      <header class="branch-group-head">
        <h3>${esc(addr.title)}</h3>
        <p>${esc(addr.lead)}</p>
      </header>
      ${inAddress(key).map(branchRow).join('')}
    </div>`).join('');

  const v = $('#veranda-img');
  v.src = photo(VERANDA_PHOTO, 800);
  v.srcset = srcset(VERANDA_PHOTO);
  v.sizes = '(max-width: 800px) 100vw, 45vw';

  $('#set-grid').innerHTML = SETS.map((s) => `
    <article class="set">
      <p class="set-when mono">${s.when}</p>
      <h3>${s.name}</h3>
      <p class="set-items">${s.items}</p>
      <p class="set-price"><strong class="mono">${money(s.price)}</strong> <s class="mono">${money(s.old)}</s></p>
      <p class="set-save mono">Экономия ${money(s.old - s.price)}</p>
    </article>`).join('');

  $('#club-rows').innerHTML = CLUB_LEVELS.map((l) => `<tr><td>${l.visits}</td><td class="mono volt">${l.cashback}</td><td class="mono">${l.spend}</td></tr>`).join('');
  $('#club-link').href = CONFIG.clubBot;

  const tastes = [FOOD[0].items[2], FOOD[1].items[2], FOOD[7].items[0]];
  $('#food-photos').innerHTML = tastes.map((f) => `
    <figure><img src="${photo(f.img, 480)}" alt="" loading="lazy"><figcaption>${esc(f.name)}<span class="mono">${money(f.price)}</span></figcaption></figure>`).join('');

  $('#faq-list').innerHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="faq-content"><p>${esc(a)}</p></div></details>`).join('');

  for (const [key, a] of Object.entries(ADDRESSES)) {
    $(`#addr-${key}`).innerHTML = `
      <p class="filter-label">${esc(a.branches)}</p>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.note)}</p>
      <a class="text-link" href="${a.map}" target="_blank" rel="noopener">Открыть на карте</a>`;
  }
  $('#foot-ig').href = CONFIG.instagram;
  $('#foot-tg').href = CONFIG.telegram;
  $('#foot-review').href = CONFIG.review;
}

/* ——— Игры ——— */
let gameTab = Object.keys(GAMES)[0];
function renderGames() {
  $('#game-tabs').innerHTML = Object.keys(GAMES).map((t) => `<button type="button" data-tab="${t}" aria-pressed="${t === gameTab}">${t}</button>`).join('');
  const q = $('#game-search').value.trim().toLowerCase();
  const tabs = q ? Object.keys(GAMES) : [gameTab];
  const html = [];
  for (const tab of tabs) {
    for (const [group, list] of Object.entries(GAMES[tab])) {
      const items = list.filter((g) => g.toLowerCase().includes(q));
      if (!items.length) continue;
      html.push(`<div class="game-group"><h3>${q ? `${tab}: ` : ''}${esc(group)}</h3><ul>${items.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>`);
    }
  }
  $('#game-groups').innerHTML = html.join('') || '<p class="game-empty">Такой игры в списке нет. Можно установить её в кабинке с вашего аккаунта: спросите сотрудника.</p>';
}

/* ——— Выпадающие списки формы ———
   Системный список браузера анимировать нельзя, поэтому поверх скрытого select рисуем свой.
   Сам select остаётся источником значения: остальной код работает с ним как обычно. */
const customSelects = [];

function refreshSelect(cs) {
  const { select, panel, valueEl } = cs;
  if (cs.signature !== select.innerHTML) {
    cs.signature = select.innerHTML;
    let n = 0;
    const optionHtml = (o) => {
      const [name, ...meta] = o.textContent.split(' · ');
      const i = n++;
      return `<div class="cselect-option" role="option" id="${cs.id}-o${i}" data-value="${esc(o.value)}" style="--i:${i}">
        <span class="cselect-text"><span>${esc(name)}</span>${meta.length ? `<small>${esc(meta.join(' · '))}</small>` : ''}</span>${ICONS.check}</div>`;
    };
    panel.innerHTML = [...select.children].map((el) => (el.tagName === 'OPTGROUP'
      ? `<div class="cselect-group" role="group" aria-label="${esc(el.label)}"><div class="cselect-group-label" style="--i:${n}">${esc(el.label)}</div>${[...el.children].map(optionHtml).join('')}</div>`
      : optionHtml(el))).join('');
  }
  const current = select.selectedOptions[0];
  valueEl.textContent = current ? current.textContent : '';
  $$('.cselect-option', panel).forEach((o) => o.setAttribute('aria-selected', o.dataset.value === select.value));
}

function setActiveOption(cs, option, reveal = true) {
  $$('.cselect-option.active', cs.panel).forEach((o) => o.classList.remove('active'));
  if (!option) { cs.trigger.removeAttribute('aria-activedescendant'); return; }
  option.classList.add('active');
  cs.trigger.setAttribute('aria-activedescendant', option.id);
  if (reveal) {
    const { panel } = cs;
    const top = option.offsetTop;
    if (top < panel.scrollTop) panel.scrollTop = top;
    else if (top + option.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = top + option.offsetHeight - panel.clientHeight;
  }
}

function openSelect(cs) {
  customSelects.forEach((other) => { if (other !== cs) closeSelect(other); });
  cs.root.classList.add('open');
  cs.trigger.setAttribute('aria-expanded', 'true');
  const selected = $('.cselect-option[aria-selected="true"]', cs.panel) || $('.cselect-option', cs.panel);
  cs.panel.scrollTop = selected ? Math.max(0, selected.offsetTop - cs.panel.clientHeight / 2 + selected.offsetHeight / 2) : 0;
  setActiveOption(cs, selected, false);
  /* Если список не помещается в окне формы, плавно прокручиваем форму */
  const dialog = cs.root.closest('dialog');
  if (dialog) {
    const overflow = cs.panel.getBoundingClientRect().bottom + 12 - dialog.getBoundingClientRect().bottom;
    if (overflow > 0) dialog.scrollBy({ top: overflow, behavior: motionOK() ? 'smooth' : 'auto' });
  }
}

function closeSelect(cs) {
  cs.root.classList.remove('open');
  cs.trigger.setAttribute('aria-expanded', 'false');
  setActiveOption(cs, null);
}

function chooseOption(cs, option) {
  cs.select.value = option.dataset.value;
  cs.select.dispatchEvent(new Event('change', { bubbles: true }));
  refreshSelect(cs);
  closeSelect(cs);
  cs.trigger.focus();
}

function enhanceSelect(select) {
  const id = `cselect-${customSelects.length + 1}`;
  const root = document.createElement('div');
  root.className = 'cselect';
  root.innerHTML = `
    <button class="cselect-trigger" type="button" id="${id}-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list">
      <span class="cselect-value"></span>${ICONS.chevron}
    </button>
    <div class="cselect-panel" id="${id}-list" role="listbox"></div>`;
  select.before(root);
  root.append(select);
  select.classList.add('cselect-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const label = $(`label[for="${select.id}"]`);
  const trigger = $('.cselect-trigger', root);
  if (label) label.htmlFor = trigger.id;

  const cs = { id, select, root, trigger, panel: $('.cselect-panel', root), valueEl: $('.cselect-value', root), signature: null };
  customSelects.push(cs);
  refreshSelect(cs);

  trigger.addEventListener('click', () => (root.classList.contains('open') ? closeSelect(cs) : openSelect(cs)));
  trigger.addEventListener('keydown', (e) => {
    const isOpen = root.classList.contains('open');
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openSelect(cs); }
      return;
    }
    const options = $$('.cselect-option', cs.panel);
    const current = options.findIndex((o) => o.classList.contains('active'));
    const moves = { ArrowDown: Math.min(current + 1, options.length - 1), ArrowUp: Math.max(current - 1, 0), Home: 0, End: options.length - 1 };
    if (e.key in moves) { e.preventDefault(); setActiveOption(cs, options[moves[e.key]]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[current]) chooseOption(cs, options[current]); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSelect(cs); }
    else if (e.key === 'Tab') closeSelect(cs);
  });
  /* Фокус остаётся на кнопке, чтобы работала клавиатура */
  cs.panel.addEventListener('mousedown', (e) => e.preventDefault());
  cs.panel.addEventListener('click', (e) => {
    const option = e.target.closest('.cselect-option');
    if (option) chooseOption(cs, option);
  });
  cs.panel.addEventListener('mousemove', (e) => {
    const option = e.target.closest('.cselect-option');
    if (option && !option.classList.contains('active')) setActiveOption(cs, option, false);
  });
}

document.addEventListener('click', (e) => {
  customSelects.forEach((cs) => { if (!cs.root.contains(e.target)) closeSelect(cs); });
});

/* ——— События ——— */
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;

  if (t.dataset.step) setFilters({ guests: Math.min(MAX_GUESTS, Math.max(0, state.guests + Number(t.dataset.step))) });
  else if (t.dataset.location) setFilters({ location: state.location === t.dataset.location ? null : t.dataset.location });
  else if (t.dataset.branch) setFilters({ branch: t.dataset.branch });
  else if (t.dataset.branchLink) { setFilters({ branch: t.dataset.branchLink, guests: 0, karaoke: false }); goToCabins(); }
  else if (t.dataset.open) openCabin(t.dataset.open, Number(t.dataset.start || 0));
  else if (t.dataset.book !== undefined) openBooking(t.dataset.book);
  else if (t.dataset.close !== undefined) closeDialog(t.closest('dialog'));
  else if (t.dataset.tab) { gameTab = t.dataset.tab; $('#game-search').value = ''; renderGames(); }
  else if (t.dataset.photo !== undefined) {
    const c = cabinById($('#cabin-dialog').dataset.cabin);
    const i = Number(t.dataset.photo);
    const main = $('#gallery-main');
    if (motionOK()) {
      main.addEventListener('load', () => main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }), { once: true });
    }
    main.src = photo(c.photos[i], 1200);
    main.alt = `${c.title}, ${branchOf(c.b).name}, фото ${i + 1} из ${c.photos.length}`;
    $$('[data-photo]').forEach((b) => b.setAttribute('aria-pressed', b === t));
  }
  else if (t.id === 'show-more') { state.showAll = true; renderFinder(); }
  else if (t.id === 'reset-filters') setFilters({ guests: 0, location: null, karaoke: false });
  else if (t.id === 'b-today') { book.date = toISO(operatingDay()); renderBooking(); }
  else if (t.id === 'b-tomorrow') { book.date = toISO(addDays(operatingDay(), 1)); renderBooking(); }
  else if (t.id === 'b-hours-minus') { book.hours--; renderBooking(); }
  else if (t.id === 'b-hours-plus') { book.hours++; renderBooking(); }
  else if (t.id === 'b-guests-minus') { book.guests--; renderBooking(); }
  else if (t.id === 'b-guests-plus') { book.guests++; renderBooking(); }
});

$$('[data-karaoke]').forEach((el) => el.addEventListener('change', () => setFilters({ karaoke: el.checked })));
$('#quick').addEventListener('submit', (e) => { e.preventDefault(); goToCabins(); });

$('#b-cabin').addEventListener('change', (e) => { book.cabin = e.target.value; renderBooking(); });
$('#b-time').addEventListener('change', (e) => { book.time = Number(e.target.value); renderBooking(); });
$('#b-date').addEventListener('change', (e) => { if (e.target.value && e.target.value >= e.target.min) book.date = e.target.value; renderBooking(); });
$('#b-phone').addEventListener('input', (e) => {
  e.target.value = formatPhone(e.target.value);
  if (e.target.value.replace(/\D/g, '').length === 12) { e.target.setAttribute('aria-invalid', 'false'); $('#b-phone-err').hidden = true; }
});
$('#b-name').addEventListener('input', (e) => {
  if (e.target.value.trim()) { e.target.setAttribute('aria-invalid', 'false'); $('#b-name-err').hidden = true; }
});
$('#b-terms').addEventListener('change', (e) => {
  if (e.target.checked) { e.target.setAttribute('aria-invalid', 'false'); $('#b-terms-err').hidden = true; }
});
$('#book-form').addEventListener('submit', submitBooking);
$('#game-search').addEventListener('input', renderGames);

/* Фото в карточке: на телефоне листаются свайпом, на компьютере — движением мыши */
const cabinGrid = $('#cabin-grid');
cabinGrid.addEventListener('scroll', (e) => {
  const track = e.target;
  if (!track.classList || !track.classList.contains('room-track')) return;
  const i = Math.round(track.scrollLeft / track.clientWidth);
  $$('.room-bars i', track.parentElement).forEach((bar, n) => bar.classList.toggle('on', n === i));
}, true);
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  cabinGrid.addEventListener('mousemove', (e) => {
    const media = e.target.closest('.room-media');
    if (!media) return;
    const track = $('.room-track', media);
    const box = media.getBoundingClientRect();
    const count = track.children.length;
    const i = Math.min(count - 1, Math.floor(((e.clientX - box.left) / box.width) * count));
    track.scrollLeft = i * track.clientWidth;
  });
  cabinGrid.addEventListener('mouseover', (e) => {
    const media = e.target.closest('.room-media');
    if (media) $$('img', media).forEach((img) => { img.loading = 'eager'; });
  });
  cabinGrid.addEventListener('mouseout', (e) => {
    const media = e.target.closest('.room-media');
    if (media && !media.contains(e.relatedTarget)) $('.room-track', media).scrollLeft = 0;
  });
}

/* Клик по затемнению закрывает диалог */
$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const box = d.getBoundingClientRect();
    const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
    if (!inside) closeDialog(d);
  });
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    const openList = customSelects.find((cs) => d.contains(cs.root) && cs.root.classList.contains('open'));
    if (openList) closeSelect(openList);
    else closeDialog(d);
  });
  d.addEventListener('close', () => customSelects.forEach(closeSelect));
});

/* Аккордеон FAQ: высота раскрывается и сворачивается за 200 мс */
$('#faq-list').addEventListener('click', (e) => {
  const summary = e.target.closest('summary');
  if (!summary || !motionOK()) return;
  e.preventDefault();
  const item = summary.parentElement;
  const box = $('.faq-content', item);
  const closing = item.dataset.closing === 'true';
  if (item.faqAnimation) item.faqAnimation.cancel();

  if (item.open && !closing) {
    item.dataset.closing = 'true';
    item.faqAnimation = box.animate([{ height: box.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 200, easing: 'ease-out' });
    item.faqAnimation.onfinish = () => { item.open = false; item.dataset.closing = 'false'; };
  } else {
    item.dataset.closing = 'false';
    item.open = true;
    item.faqAnimation = box.animate([{ height: '0px', opacity: 0 }, { height: box.offsetHeight + 'px', opacity: 1 }], { duration: 200, easing: 'ease-out' });
  }
});

/* Мобильное меню: плавность задана в CSS, здесь только переключаем состояние */
const navToggle = $('.nav-toggle');
const nav = $('#nav');
const navScrim = $('.nav-scrim');

function setNav(open) {
  navToggle.setAttribute('aria-expanded', open);
  navToggle.textContent = open ? 'Закрыть' : 'Меню';
  nav.classList.toggle('open', open);
  navScrim.classList.toggle('open', open);
}

navToggle.addEventListener('click', () => setNav(navToggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => { if (e.target.closest('a, button')) setNav(false); });
document.addEventListener('click', (e) => { if (!e.target.closest('.site-header')) setNav(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
    setNav(false);
    navToggle.focus();
  }
});

/* Старые адреса страниц (/luxury и другие) и ссылка «забронировать» с других страниц */
function applyHash() {
  const h = location.hash.slice(1);
  if (BRANCHES.some((b) => b.id === h)) setFilters({ branch: h, guests: 0 });
  if (h === 'book') openBooking();
}

fillCabinSelect();
enhanceSelect($('#b-cabin'));
enhanceSelect($('#b-time'));
renderStatic();
renderFinder();
renderGames();
applyHash();
window.addEventListener('hashchange', applyHash);
