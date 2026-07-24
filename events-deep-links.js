(() => {
  if (window.__OC_EVENTS_DEEP_LINKS_READY__) return;

  const MODES = new Set(['rating', 'guess', 'bestworst', 'predictions', 'codenames', 'blindtier', 'whoami']);
  const STAGES = new Set(['basket', 'first', 'semi', 'final']);
  const SEASONS = new Set(['winter', 'spring', 'summer', 'fall']);
  const SEASON_LABEL = { winter: 'зима', spring: 'весна', summer: 'лето', fall: 'осень' };
  let applying = false;
  let seasonTimer = 0;

  function currentUrl() {
    return new URL(window.location.href);
  }

  function activeMode() {
    return document.querySelector('.ev-mode-tab.active[data-mode]')?.dataset.mode || 'rating';
  }

  function activeStage() {
    return document.querySelector('.ev-tab.active[data-stage]')?.dataset.stage || 'basket';
  }

  function clickedRoomId(target) {
    const element = target?.closest?.('[data-room-id], [data-event-room]');
    return String(element?.dataset.roomId || element?.dataset.eventRoom || '').trim();
  }

  function seasonFromButton(button) {
    const direct = String(button?.dataset?.season || button?.dataset?.eventSeason || '').toLowerCase();
    if (SEASONS.has(direct)) return direct;
    const text = String(button?.textContent || '').toLowerCase();
    return [...SEASONS].find(season => text.includes(SEASON_LABEL[season])) || '';
  }

  function yearFromButton(button) {
    const direct = String(button?.dataset?.year || button?.dataset?.eventYear || '');
    if (/^\d{4}$/.test(direct)) return direct;
    return String(button?.textContent || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  }

  function writeUrl({ mode, stage, year, season, room }, replace = false) {
    const url = currentUrl();
    const params = url.searchParams;
    const nextMode = MODES.has(mode) ? mode : 'rating';

    params.set('mode', nextMode);
    if (nextMode === 'rating' && STAGES.has(stage)) params.set('stage', stage);
    else params.delete('stage');

    if (nextMode === 'rating' && SEASONS.has(season)) params.set('season', season);
    else params.delete('season');

    if (nextMode === 'rating' && year && /^\d{4}$/.test(String(year))) params.set('year', String(year));
    else params.delete('year');

    if (room) params.set('room', room);
    else if (!['bestworst', 'codenames', 'whoami'].includes(nextMode)) params.delete('room');

    const query = params.toString();
    const next = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
    history[replace ? 'replaceState' : 'pushState']({ eventsDeepLink: true }, '', next);
  }

  function syncFromUi(replace = false, extras = {}) {
    writeUrl({ mode: activeMode(), stage: activeStage(), ...extras }, replace);
  }

  function clickSelector(selector) {
    const element = document.querySelector(selector);
    if (!element) return false;
    element.click();
    return true;
  }

  function applySeason(season, year, attempt = 0) {
    window.clearTimeout(seasonTimer);
    if (!SEASONS.has(season) || activeMode() !== 'rating') return;

    const buttons = [...document.querySelectorAll('.ev-season-btn, [data-event-season]')];
    const match = buttons.find(button => {
      const buttonSeason = seasonFromButton(button);
      const buttonYear = yearFromButton(button);
      return buttonSeason === season && (!year || !buttonYear || buttonYear === String(year));
    });

    if (match) {
      match.click();
      return;
    }

    if (attempt < 20) seasonTimer = window.setTimeout(() => applySeason(season, year, attempt + 1), 150);
  }

  function applyRoom(room, mode, attempt = 0) {
    if (!room || !['bestworst', 'codenames', 'whoami'].includes(mode)) return;
    const candidates = [...document.querySelectorAll('[data-room-id], [data-event-room]')];
    const match = candidates.find(element => String(element.dataset.roomId || element.dataset.eventRoom || '') === room);
    if (match) {
      match.click();
      return;
    }
    if (attempt < 20) window.setTimeout(() => applyRoom(room, mode, attempt + 1), 150);
  }

  function applyFromUrl() {
    const params = currentUrl().searchParams;
    const requestedMode = MODES.has(params.get('mode')) ? params.get('mode') : 'rating';
    const requestedStage = STAGES.has(params.get('stage')) ? params.get('stage') : 'basket';
    const requestedSeason = SEASONS.has(params.get('season')) ? params.get('season') : '';
    const requestedYear = /^\d{4}$/.test(params.get('year') || '') ? params.get('year') : '';
    const requestedRoom = String(params.get('room') || '').trim();

    applying = true;
    clickSelector(`.ev-mode-tab[data-mode="${requestedMode}"]`);
    if (requestedMode === 'rating') clickSelector(`.ev-tab[data-stage="${requestedStage}"]`);
    if (requestedSeason) applySeason(requestedSeason, requestedYear);
    if (requestedRoom) applyRoom(requestedRoom, requestedMode);

    window.setTimeout(() => {
      applying = false;
      if (params.has('mode') || params.has('stage') || params.has('season') || params.has('room')) {
        syncFromUi(true, { year: requestedYear, season: requestedSeason, room: requestedRoom });
      }
    }, 50);
  }

  function bind() {
    document.addEventListener('click', event => {
      if (applying) return;

      const modeButton = event.target.closest('.ev-mode-tab[data-mode]');
      if (modeButton) {
        const mode = MODES.has(modeButton.dataset.mode) ? modeButton.dataset.mode : 'rating';
        window.setTimeout(() => writeUrl({ mode, stage: activeStage() }), 0);
        return;
      }

      const stageButton = event.target.closest('.ev-tab[data-stage]');
      if (stageButton) {
        const stage = STAGES.has(stageButton.dataset.stage) ? stageButton.dataset.stage : 'basket';
        window.setTimeout(() => writeUrl({ mode: activeMode(), stage }), 0);
        return;
      }

      const seasonButton = event.target.closest('.ev-season-btn, [data-event-season]');
      if (seasonButton && activeMode() === 'rating') {
        const season = seasonFromButton(seasonButton);
        const year = yearFromButton(seasonButton);
        if (SEASONS.has(season)) window.setTimeout(() => writeUrl({ mode: 'rating', stage: activeStage(), season, year }), 0);
        return;
      }

      const room = clickedRoomId(event.target);
      if (room && ['bestworst', 'codenames', 'whoami'].includes(activeMode())) {
        window.setTimeout(() => writeUrl({ mode: activeMode(), room }), 0);
      }
    });

    window.addEventListener('popstate', () => {
      window.clearTimeout(seasonTimer);
      applyFromUrl();
    });

    window.__OC_EVENTS_DEEP_LINKS_READY__ = true;
    window.setTimeout(applyFromUrl, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
