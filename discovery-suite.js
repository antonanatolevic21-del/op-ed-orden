(() => {
  if (window.__OC_DISCOVERY_SUITE_READY__) return;
  window.__OC_DISCOVERY_SUITE_READY__ = true;

  const panel = document.querySelector('#oc-discovery-panel');
  if (!panel) return;

  const bridge = () => window.OC_APP_BRIDGE;
  const state = {
    active: 'recommendations',
    recommendationType: '',
    comparisonA: '',
    comparisonB: '',
    researchMode: 'polarizing',
    researchType: '',
    researchMinVotes: 3,
    duelType: 'OP',
    duelMode: 'new',
    duel: null,
    collectionOwner: '',
    collectionDraft: null,
    collectionSearch: '',
    collectionMessage: '',
    journal: [],
    journalUnsubscribe: null,
    renderQueued: false
  };

  const TAB_META = [
    ['recommendations', 'Для тебя'],
    ['duel', 'Дуэльный топ'],
    ['comparison', 'Сравнить вкусы'],
    ['research', 'Исследования'],
    ['collections', 'Подборки'],
    ['journal', 'Журнал']
  ];
  const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' };
  const FIELD_LABELS = {
    title: 'Название',
    type: 'Тип',
    year: 'Год',
    season: 'Сезон',
    studios: 'Студии',
    directors: 'Режиссёры',
    performers: 'Исполнители',
    franchises: 'Франшизы',
    alternativeTitles: 'Альтернативные названия',
    sameSongGroupId: 'Группа одной песни',
    sameSongTitle: 'Общее название песни',
    image: 'Основная картинка',
    fallbackImage: 'Запасная картинка',
    link: 'Видео',
    notes: 'Заметки',
    isChinese: 'Китайский OP/ED',
    isMovie: 'Фильм',
    isShortened: 'Укороченная версия'
  };

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  }

  function snapshot() {
    return bridge()?.snapshot?.() || window.OC_APP_DATA || {
      entries: [],
      ratings: [],
      manualRanks: {},
      userProfiles: [],
      currentUser: {}
    };
  }

  function entries() {
    return Array.isArray(snapshot().entries) ? snapshot().entries : [];
  }

  function profiles() {
    return Array.isArray(snapshot().userProfiles) ? snapshot().userProfiles : [];
  }

  function currentName() {
    return String(snapshot().currentUser?.nickname || '').trim();
  }

  function profileName(profile) {
    return String(profile?.nickname || profile?.displayName || profile?.name || profile?.id || '').trim();
  }

  function valueForUser(map, user) {
    if (!map || !user) return null;
    if (Object.prototype.hasOwnProperty.call(map, user)) {
      const direct = Number(map[user]);
      return Number.isFinite(direct) ? direct : null;
    }
    const target = normalize(user);
    for (const [key, value] of Object.entries(map)) {
      if (normalize(key) !== target) continue;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    return null;
  }

  function score(entry, user, metric = 'scores') {
    return valueForUser(entry?.[metric], user);
  }

  function allUsers() {
    const names = new Map();
    profiles().forEach(profile => {
      const name = profileName(profile);
      if (name) names.set(normalize(name), name);
    });
    entries().forEach(entry => {
      ['scores', 'songScores', 'visualScores'].forEach(metric => {
        Object.keys(entry?.[metric] || {}).forEach(name => {
          if (name && !name.startsWith('__')) names.set(normalize(name), name);
        });
      });
    });
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function entryMeta(entry) {
    const period = entry.year ? `${SEASON_LABELS[entry.season] || ''} ${entry.year}`.trim() : 'год не указан';
    return `${entry.type || '—'} · ${period}`;
  }

  function imageFor(entry) {
    return String(entry?.fallbackImage || entry?.image || '').trim();
  }

  function mountImageFallbacks(root = panel) {
    root.querySelectorAll('img[data-discovery-image]').forEach(image => {
      if (image.dataset.discoveryBound === '1') return;
      image.dataset.discoveryBound = '1';
      image.addEventListener('error', () => {
        const fallback = String(image.dataset.fallback || '').trim();
        if (fallback && image.src !== new URL(fallback, location.href).href) {
          image.src = fallback;
          return;
        }
        image.hidden = true;
      });
    });
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const avg = mean(values);
    return Math.sqrt(values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length);
  }

  function pearson(pairs) {
    if (pairs.length < 2) return 0;
    const avgA = mean(pairs.map(pair => pair.a));
    const avgB = mean(pairs.map(pair => pair.b));
    let numerator = 0;
    let squareA = 0;
    let squareB = 0;
    pairs.forEach(pair => {
      const a = pair.a - avgA;
      const b = pair.b - avgB;
      numerator += a * b;
      squareA += a * a;
      squareB += b * b;
    });
    const denominator = Math.sqrt(squareA * squareB);
    return denominator ? numerator / denominator : 0;
  }

  function ratingStats(entry, metric = 'scores') {
    const values = Object.entries(entry?.[metric] || {})
      .filter(([name]) => !name.startsWith('__'))
      .map(([, value]) => Number(value))
      .filter(Number.isFinite);
    const aggregate = entry?.[metric]?.__oc_aggregate_stats;
    if (!values.length && aggregate && Number(aggregate.count) > 0) {
      return {
        values: [],
        count: Number(aggregate.count),
        average: Number(aggregate.avgAny),
        deviation: null
      };
    }
    return {
      values,
      count: values.length,
      average: mean(values),
      deviation: values.length > 1 ? standardDeviation(values) : null
    };
  }

  function userRatings(user, type = '', metric = 'scores') {
    return entries()
      .filter(entry => !type || entry.type === type)
      .map(entry => ({ entry, value: score(entry, user, metric) }))
      .filter(row => row.value !== null);
  }

  function similarityBetween(a, b, type = '') {
    const pairs = [];
    entries().forEach(entry => {
      if (type && entry.type !== type) return;
      const left = score(entry, a);
      const right = score(entry, b);
      if (left !== null && right !== null) pairs.push({ a: left, b: right, entry });
    });
    if (pairs.length < 5) return { raw: 0, weighted: 0, common: pairs.length, pairs };
    const raw = pearson(pairs);
    return {
      raw,
      weighted: raw * (pairs.length / (pairs.length + 18)),
      common: pairs.length,
      pairs
    };
  }

  function favoriteEntities(user) {
    const groups = new Map();
    userRatings(user).filter(row => row.value >= 8).forEach(({ entry, value }) => {
      [
        ...(entry.studios || []).map(name => ['студия', name]),
        ...(entry.directors || []).map(name => ['режиссёр', name]),
        ...(entry.performers || []).map(name => ['исполнитель', name]),
        ...(entry.franchises || []).map(name => ['франшиза', name])
      ].forEach(([kind, name]) => {
        const key = `${kind}:${normalize(name)}`;
        const current = groups.get(key) || { kind, name, count: 0, sum: 0 };
        current.count += 1;
        current.sum += value;
        groups.set(key, current);
      });
    });
    return [...groups.values()]
      .filter(row => row.count >= 2)
      .sort((a, b) => b.count - a.count || (b.sum / b.count) - (a.sum / a.count));
  }

  function recommendationsFor(user, type = '') {
    if (!user) return [];
    const neighbors = allUsers()
      .filter(name => normalize(name) !== normalize(user))
      .map(name => ({ name, ...similarityBetween(user, name, type) }))
      .filter(row => row.common >= 5 && row.weighted > 0.03)
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 8);
    const userRows = userRatings(user, type);
    const userMean = mean(userRows.map(row => row.value)) || 7;
    const neighborMeans = new Map(neighbors.map(row => [row.name, mean(userRatings(row.name, type).map(item => item.value)) || 7]));
    const favorites = favoriteEntities(user).slice(0, 14);

    return entries()
      .filter(entry => (!type || entry.type === type) && score(entry, user) === null)
      .map(entry => {
        let numerator = 0;
        let denominator = 0;
        const supporters = [];
        neighbors.forEach(neighbor => {
          const neighborScore = score(entry, neighbor.name);
          if (neighborScore === null) return;
          numerator += neighbor.weighted * (neighborScore - neighborMeans.get(neighbor.name));
          denominator += Math.abs(neighbor.weighted);
          supporters.push({ name: neighbor.name, score: neighborScore, similarity: neighbor.weighted });
        });
        const entityNames = new Set([
          ...(entry.studios || []),
          ...(entry.directors || []),
          ...(entry.performers || []),
          ...(entry.franchises || [])
        ].map(normalize));
        const matchedFavorite = favorites.find(row => entityNames.has(normalize(row.name)));
        const entityBonus = matchedFavorite ? Math.min(.45, .08 * matchedFavorite.count) : 0;
        const publicStats = ratingStats(entry);
        let predicted = denominator ? userMean + numerator / denominator : publicStats.average;
        if (!Number.isFinite(predicted)) predicted = 0;
        predicted = Math.max(.5, Math.min(10, predicted + entityBonus));
        const confidence = Math.min(100, Math.round(25 + supporters.length * 12 + Math.min(25, denominator * 35)));
        supporters.sort((a, b) => b.similarity - a.similarity || b.score - a.score);
        return { entry, predicted, confidence, supporters, matchedFavorite, publicStats };
      })
      .filter(row => row.predicted >= 6.5 && (row.supporters.length >= 1 || row.publicStats.count >= 3))
      .sort((a, b) => b.predicted - a.predicted || b.confidence - a.confidence)
      .slice(0, 36);
  }

  function trackCard(row) {
    const entry = row.entry;
    const supporter = row.supporters?.[0];
    const reason = row.matchedFavorite
      ? `Тебе часто нравится ${row.matchedFavorite.kind} ${row.matchedFavorite.name}.`
      : supporter
        ? `${supporter.name} с похожим вкусом поставил${/а$/i.test(supporter.name) ? 'а' : ''} ${supporter.score}.`
        : `Средняя по сайту: ${Number(row.publicStats.average || 0).toFixed(1)}.`;
    return `<article class="oc-discovery-card">
      <div class="oc-discovery-card-media">
        ${imageFor(entry) ? `<img data-discovery-image src="${esc(imageFor(entry))}" data-fallback="${esc(entry.image || '')}" alt="" loading="lazy" />` : ''}
        <span class="oc-discovery-score">≈ ${row.predicted.toFixed(1)}</span>
      </div>
      <div class="oc-discovery-card-body">
        <h4 title="${esc(entry.title)}">${esc(entry.title)}</h4>
        <div class="oc-discovery-meta">${esc(entryMeta(entry))} · уверенность ${row.confidence}%</div>
        <div class="oc-discovery-reason">${esc(reason)}</div>
        <div class="oc-discovery-card-actions">
          <button type="button" data-discovery-open="${esc(entry.id)}">Карточка</button>
          <button type="button" data-discovery-rate="${esc(entry.id)}">Оценить</button>
        </div>
      </div>
    </article>`;
  }

  function userOptions(selected, empty = 'Выберите пользователя') {
    return `<option value="">${esc(empty)}</option>` + allUsers().map(name =>
      `<option value="${esc(name)}" ${normalize(name) === normalize(selected) ? 'selected' : ''}>${esc(name)}</option>`
    ).join('');
  }

  function renderRecommendations() {
    const user = currentName();
    const rows = recommendationsFor(user, state.recommendationType);
    const neighbors = allUsers()
      .filter(name => normalize(name) !== normalize(user))
      .map(name => ({ name, ...similarityBetween(user, name, state.recommendationType) }))
      .filter(row => row.common >= 5)
      .sort((a, b) => b.weighted - a.weighted);
    const bestNeighbor = neighbors[0];
    return `<section class="oc-discovery-view" data-discovery-view="recommendations">
      <div class="oc-discovery-head">
        <div><div class="oc-section-label">персональная выдача</div><h3>Для тебя</h3><p>Неоценённые треки, рассчитанные по похожим пользователям и твоим любимым авторам, студиям и франшизам.</p></div>
        <select class="oc-discovery-control" id="oc-discovery-recommendation-type">
          <option value="" ${!state.recommendationType ? 'selected' : ''}>OP и ED</option>
          <option value="OP" ${state.recommendationType === 'OP' ? 'selected' : ''}>Только OP</option>
          <option value="ED" ${state.recommendationType === 'ED' ? 'selected' : ''}>Только ED</option>
        </select>
      </div>
      <div class="oc-discovery-metrics">
        <div class="oc-discovery-metric"><span>Рекомендаций</span><strong>${rows.length}</strong><small>с достаточной уверенностью</small></div>
        <div class="oc-discovery-metric"><span>Ближе всего по вкусу</span><strong>${esc(bestNeighbor?.name || '—')}</strong><small>${bestNeighbor ? `${Math.round((bestNeighbor.raw + 1) * 50)}% · ${bestNeighbor.common} общих` : 'нужно больше общих оценок'}</small></div>
        <div class="oc-discovery-metric"><span>Оценено тобой</span><strong>${userRatings(user, state.recommendationType).length}</strong><small>в текущем типе</small></div>
        <div class="oc-discovery-metric"><span>Основа расчёта</span><strong>${neighbors.filter(row => row.weighted > 0).length}</strong><small>подходящих соседей</small></div>
      </div>
      ${rows.length ? `<div class="oc-discovery-grid">${rows.slice(0, 18).map(trackCard).join('')}</div>` : `<div class="oc-discovery-empty">Пока недостаточно общих оценок для персональной выдачи. Оцени ещё несколько сезонов — раздел заполнится автоматически.</div>`}
    </section>`;
  }

  function manualRanksFor(user, type) {
    const ranks = snapshot().manualRanks || {};
    const row = ranks[user] || ranks[normalize(user)] || Object.values(ranks).find(item => normalize(item?.nickname || item?.nicknameKey) === normalize(user)) || {};
    return Array.isArray(row?.[type]) ? row[type].map(String) : [];
  }

  function startDuel() {
    const user = currentName();
    const rated = userRatings(user, state.duelType)
      .sort((a, b) => b.value - a.value || String(a.entry.title).localeCompare(String(b.entry.title), 'ru'))
      .map(row => String(row.entry.id))
      .slice(0, 100);
    if (rated.length < 2) {
      state.duel = { error: `Нужно хотя бы две оценки ${state.duelType}.` };
      renderActive();
      return;
    }
    const existing = manualRanksFor(user, state.duelType).filter(id => rated.includes(id));
    if (state.duelMode === 'refine' && existing.length >= 2) {
      state.duel = {
        mode: 'refine',
        order: [...existing, ...rated.filter(id => !existing.includes(id))].slice(0, 100),
        pairIndex: 0,
        comparisons: 0
      };
    } else {
      state.duel = {
        mode: 'new',
        candidates: rated,
        order: [rated[0]],
        candidateIndex: 1,
        candidate: rated[1],
        low: 0,
        high: 1,
        comparisons: 0
      };
    }
    renderActive();
  }

  function duelEntries() {
    return new Map(entries().map(entry => [String(entry.id), entry]));
  }

  function advanceNewDuel(choice) {
    const duel = state.duel;
    if (!duel || duel.mode !== 'new' || duel.complete) return;
    duel.comparisons += 1;
    const mid = Math.floor((duel.low + duel.high) / 2);
    if (choice === 'left') duel.high = mid;
    else if (choice === 'right') duel.low = mid + 1;
    else if (choice === 'tie') duel.low = duel.high = Math.min(duel.order.length, mid + 1);
    else if (choice === 'skip') duel.low = duel.high = duel.order.length;
    if (duel.low < duel.high) {
      renderActive();
      return;
    }
    duel.order.splice(duel.low, 0, duel.candidate);
    duel.candidateIndex += 1;
    if (duel.candidateIndex >= duel.candidates.length) {
      duel.complete = true;
      renderActive();
      return;
    }
    duel.candidate = duel.candidates[duel.candidateIndex];
    duel.low = 0;
    duel.high = duel.order.length;
    renderActive();
  }

  function advanceRefineDuel(choice) {
    const duel = state.duel;
    if (!duel || duel.mode !== 'refine' || duel.complete) return;
    if (choice === 'right') {
      const left = duel.order[duel.pairIndex];
      duel.order[duel.pairIndex] = duel.order[duel.pairIndex + 1];
      duel.order[duel.pairIndex + 1] = left;
    }
    duel.comparisons += 1;
    duel.pairIndex += 1;
    if (duel.pairIndex >= duel.order.length - 1) duel.complete = true;
    renderActive();
  }

  function duelFinalOrder() {
    const duel = state.duel;
    if (!duel?.order) return [];
    if (duel.mode === 'new') {
      const remaining = (duel.candidates || []).slice(duel.candidateIndex).filter(id => id !== duel.candidate);
      return [...duel.order, ...(duel.candidate && !duel.order.includes(duel.candidate) ? [duel.candidate] : []), ...remaining].slice(0, 100);
    }
    return duel.order.slice(0, 100);
  }

  async function saveDuel() {
    const button = panel.querySelector('#oc-duel-save');
    if (button) {
      button.disabled = true;
      button.textContent = 'Сохраняю…';
    }
    try {
      await bridge()?.saveDuelRanks?.(state.duelType, duelFinalOrder());
      if (button) button.textContent = 'Сохранено ✓';
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Не удалось сохранить';
      }
      console.error(error);
    }
  }

  function duelCard(entry, side) {
    if (!entry) return '';
    return `<button class="oc-duel-card" type="button" data-duel-choice="${side}">
      ${imageFor(entry) ? `<img data-discovery-image src="${esc(imageFor(entry))}" data-fallback="${esc(entry.image || '')}" alt="" />` : '<span></span>'}
      <span class="oc-duel-card-copy"><h4>${esc(entry.title)}</h4><p>${esc(entryMeta(entry))} · твоя оценка ${score(entry, currentName()) ?? '—'}</p></span>
    </button>`;
  }

  function renderDuel() {
    const duel = state.duel;
    const byId = duelEntries();
    let body = `<div class="oc-discovery-empty">Выбери тип и режим. «Собрать заново» построит порядок последовательными сравнениями, а «Уточнить текущий» пройдёт по соседним позициям сохранённого топа.</div>`;
    if (duel?.error) body = `<div class="oc-discovery-empty">${esc(duel.error)}</div>`;
    else if (duel?.order) {
      const progress = duel.mode === 'new'
        ? Math.round((duel.candidateIndex / duel.candidates.length) * 100)
        : Math.round((duel.pairIndex / Math.max(1, duel.order.length - 1)) * 100);
      if (duel.complete) {
        const rows = duelFinalOrder();
        body = `<div class="oc-discovery-list"><h4>Готовый порядок · ${rows.length} позиций</h4>
          ${rows.slice(0, 30).map((id, index) => {
            const entry = byId.get(id);
            return `<div class="oc-discovery-row"><button data-discovery-open="${esc(id)}">${index + 1}. ${esc(entry?.title || id)}</button><span>${esc(entry ? entryMeta(entry) : '')}</span></div>`;
          }).join('')}
          ${rows.length > 30 ? `<div class="oc-discovery-meta">И ещё ${rows.length - 30} позиций.</div>` : ''}
        </div>`;
      } else {
        const leftId = duel.mode === 'new' ? duel.candidate : duel.order[duel.pairIndex];
        const rightId = duel.mode === 'new' ? duel.order[Math.floor((duel.low + duel.high) / 2)] : duel.order[duel.pairIndex + 1];
        body = `<div class="oc-duel-progress"><i style="width:${progress}%"></i></div>
          <div class="oc-discovery-meta">${progress}% · сравнений: ${duel.comparisons} · нажми на трек, который должен стоять выше</div>
          <div class="oc-duel-stage">${duelCard(byId.get(leftId), 'left')}<div class="oc-duel-vs">VS</div>${duelCard(byId.get(rightId), 'right')}</div>
          <div class="oc-duel-secondary">
            <button class="oc-discovery-button" type="button" data-duel-choice="tie">Примерно равны</button>
            <button class="oc-discovery-button" type="button" data-duel-choice="skip">Пропустить пару</button>
          </div>`;
      }
    }
    return `<section class="oc-discovery-view" data-discovery-view="duel">
      <div class="oc-discovery-head"><div><div class="oc-section-label">попарное ранжирование</div><h3>Дуэльный топ</h3><p>Выбирай лучший из двух треков. Результат можно сохранить прямо в ручной топ‑100.</p></div></div>
      <div class="oc-duel-controls">
        <div>
          <select class="oc-discovery-control" id="oc-duel-type"><option value="OP" ${state.duelType === 'OP' ? 'selected' : ''}>OP</option><option value="ED" ${state.duelType === 'ED' ? 'selected' : ''}>ED</option></select>
          <select class="oc-discovery-control" id="oc-duel-mode"><option value="new" ${state.duelMode === 'new' ? 'selected' : ''}>Собрать заново</option><option value="refine" ${state.duelMode === 'refine' ? 'selected' : ''}>Уточнить текущий</option></select>
        </div>
        <div>
          <button class="oc-discovery-button" id="oc-duel-start" type="button">${duel ? 'Начать заново' : 'Начать'}</button>
          <button class="oc-discovery-button primary" id="oc-duel-save" type="button" ${duel?.order ? '' : 'disabled'}>Сохранить в топ‑100</button>
        </div>
      </div>
      ${body}
    </section>`;
  }

  function comparisonData(a, b) {
    const shared = [];
    const onlyA = [];
    const onlyB = [];
    entries().forEach(entry => {
      const left = score(entry, a);
      const right = score(entry, b);
      if (left !== null && right !== null) shared.push({ entry, a: left, b: right, diff: Math.abs(left - right) });
      else if (left !== null && left >= 8 && right === null) onlyA.push({ entry, value: left });
      else if (right !== null && right >= 8 && left === null) onlyB.push({ entry, value: right });
    });
    shared.sort((x, y) => y.diff - x.diff);
    const correlation = shared.length >= 2 ? pearson(shared) : 0;
    const averageDiff = mean(shared.map(row => row.diff));
    const agreements = shared.filter(row => row.diff <= .5).sort((x, y) => (y.a + y.b) - (x.a + x.b));
    const topEntities = user => {
      const counts = new Map();
      userRatings(user).filter(row => row.value >= 8).forEach(({ entry }) => {
        [...(entry.studios || []), ...(entry.directors || []), ...(entry.performers || []), ...(entry.franchises || [])].forEach(name => {
          counts.set(normalize(name), { name, count: (counts.get(normalize(name))?.count || 0) + 1 });
        });
      });
      return [...counts.values()].filter(row => row.count >= 2).sort((x, y) => y.count - x.count).slice(0, 15);
    };
    const entitiesA = topEntities(a);
    const entityKeysB = new Set(topEntities(b).map(row => normalize(row.name)));
    const commonEntities = entitiesA.filter(row => entityKeysB.has(normalize(row.name))).slice(0, 8);
    return { shared, onlyA, onlyB, correlation, averageDiff, agreements, commonEntities };
  }

  function comparisonRows(title, rows, mapper) {
    return `<div class="oc-discovery-list"><h4>${esc(title)}</h4>${rows.length ? rows.slice(0, 12).map(mapper).join('') : '<div class="oc-discovery-meta">Пока нет подходящих треков.</div>'}</div>`;
  }

  function renderComparison() {
    const users = allUsers();
    if (!state.comparisonA) state.comparisonA = currentName() || users[0] || '';
    if (!state.comparisonB) state.comparisonB = users.find(name => normalize(name) !== normalize(state.comparisonA)) || '';
    const data = state.comparisonA && state.comparisonB ? comparisonData(state.comparisonA, state.comparisonB) : null;
    const compatibility = data ? Math.max(0, Math.min(100, Math.round((data.correlation + 1) * 50))) : 0;
    return `<section class="oc-discovery-view" data-discovery-view="comparison">
      <div class="oc-discovery-head"><div><div class="oc-section-label">все оценки</div><h3>Сравнение вкусов</h3><p>В отличие от сравнения топ‑100, здесь учитывается вся общая история оценок.</p></div></div>
      <div class="oc-compare-controls">
        <select class="oc-discovery-control" id="oc-compare-a">${userOptions(state.comparisonA, 'Первый пользователь')}</select>
        <span>и</span>
        <select class="oc-discovery-control" id="oc-compare-b">${userOptions(state.comparisonB, 'Второй пользователь')}</select>
      </div>
      ${data ? `<div class="oc-compare-summary">
        <div class="oc-discovery-metric"><span>Совместимость</span><strong>${compatibility}%</strong><small>корреляция оценок</small></div>
        <div class="oc-discovery-metric"><span>Общих оценок</span><strong>${data.shared.length}</strong><small>для сравнения</small></div>
        <div class="oc-discovery-metric"><span>Среднее расхождение</span><strong>${data.averageDiff === null ? '—' : data.averageDiff.toFixed(2)}</strong><small>балла</small></div>
        <div class="oc-discovery-metric"><span>Почти одинаково</span><strong>${data.agreements.length}</strong><small>разница не больше 0.5</small></div>
      </div>
      <div class="oc-compare-columns">
        ${comparisonRows('Самые большие расхождения', data.shared, row => `<div class="oc-discovery-row"><button data-discovery-open="${esc(row.entry.id)}">${esc(row.entry.title)}</button><span>${row.a} ↔ ${row.b} · Δ ${row.diff.toFixed(1)}</span></div>`)}
        ${comparisonRows('Общие любимые связи', data.commonEntities, row => `<div class="oc-discovery-row"><button type="button">${esc(row.name)}</button><span>любят оба</span></div>`)}
        ${comparisonRows(`${state.comparisonA} рекомендует`, data.onlyA.sort((x, y) => y.value - x.value), row => `<div class="oc-discovery-row"><button data-discovery-open="${esc(row.entry.id)}">${esc(row.entry.title)}</button><span>${row.value} · у второго нет оценки</span></div>`)}
        ${comparisonRows(`${state.comparisonB} рекомендует`, data.onlyB.sort((x, y) => y.value - x.value), row => `<div class="oc-discovery-row"><button data-discovery-open="${esc(row.entry.id)}">${esc(row.entry.title)}</button><span>${row.value} · у первого нет оценки</span></div>`)}
      </div>` : '<div class="oc-discovery-empty">Выбери двух пользователей.</div>'}
    </section>`;
  }

  function filteredResearchEntries() {
    return entries().filter(entry => !state.researchType || entry.type === state.researchType);
  }

  function entityLeaderboard() {
    const groups = new Map();
    filteredResearchEntries().forEach(entry => {
      const stats = ratingStats(entry);
      if (stats.count < state.researchMinVotes || !Number.isFinite(stats.average)) return;
      [
        ...(entry.studios || []).map(name => ['Студия', name]),
        ...(entry.directors || []).map(name => ['Режиссёр', name]),
        ...(entry.performers || []).map(name => ['Исполнитель', name]),
        ...(entry.franchises || []).map(name => ['Франшиза', name])
      ].forEach(([kind, name]) => {
        const key = `${kind}:${normalize(name)}`;
        const group = groups.get(key) || { kind, name, tracks: [], votes: 0 };
        group.tracks.push(stats.average);
        group.votes += stats.count;
        groups.set(key, group);
      });
    });
    const allTrackMeans = [...groups.values()].flatMap(group => group.tracks);
    const globalMean = mean(allTrackMeans) || 7;
    return [...groups.values()]
      .filter(group => group.tracks.length >= 3)
      .map(group => {
        const raw = mean(group.tracks);
        const weighted = (raw * group.tracks.length + globalMean * 5) / (group.tracks.length + 5);
        return { ...group, raw, weighted };
      })
      .sort((a, b) => b.weighted - a.weighted || b.tracks.length - a.tracks.length);
  }

  function researchRows() {
    const rows = filteredResearchEntries().map(entry => ({ entry, ...ratingStats(entry) }))
      .filter(row => row.count >= state.researchMinVotes && Number.isFinite(row.average));
    if (state.researchMode === 'polarizing') {
      return rows.filter(row => row.deviation !== null).sort((a, b) => b.deviation - a.deviation).slice(0, 40);
    }
    if (state.researchMode === 'hidden') {
      const counts = rows.map(row => row.count).sort((a, b) => a - b);
      const median = counts[Math.floor(counts.length / 2)] || 5;
      return rows.filter(row => row.count <= median && row.average >= 7.5).sort((a, b) => b.average - a.average || a.count - b.count).slice(0, 40);
    }
    if (state.researchMode === 'consensus') {
      return rows.filter(row => row.deviation !== null && row.average >= 7.5).sort((a, b) => a.deviation - b.deviation || b.average - a.average).slice(0, 40);
    }
    if (state.researchMode === 'personal') {
      const user = currentName();
      return rows.map(row => {
        const own = score(row.entry, user);
        return { ...row, own, personalDiff: own === null ? null : Math.abs(own - row.average) };
      }).filter(row => row.personalDiff !== null).sort((a, b) => b.personalDiff - a.personalDiff).slice(0, 40);
    }
    return entityLeaderboard().slice(0, 50);
  }

  function researchExplanation() {
    const copy = {
      polarizing: ['Самые спорные', 'Высокое стандартное отклонение: пользователи оценивают эти треки очень по-разному.'],
      hidden: ['Скрытые жемчужины', 'Высокая средняя при количестве голосов не выше медианы каталога.'],
      consensus: ['Общий консенсус', 'Высокая средняя и минимальный разброс — редкие случаи, когда почти все согласны.'],
      entities: ['Лучшие связи', 'Байесовский рейтинг студий, режиссёров, исполнителей и франшиз. Маленькие группы получают поправку к общей средней.'],
      personal: ['Ты против большинства', 'Треки, где твоя оценка сильнее всего отличается от средней по сайту.']
    };
    return copy[state.researchMode] || copy.polarizing;
  }

  function renderResearch() {
    const rows = researchRows();
    const explanation = researchExplanation();
    const isEntity = state.researchMode === 'entities';
    return `<section class="oc-discovery-view" data-discovery-view="research">
      <div class="oc-discovery-head"><div><div class="oc-section-label">исследовательский центр</div><h3>${esc(explanation[0])}</h3><p>${esc(explanation[1])}</p></div></div>
      <div class="oc-research-controls">
        <select class="oc-discovery-control" id="oc-research-mode">
          <option value="polarizing" ${state.researchMode === 'polarizing' ? 'selected' : ''}>Самые спорные</option>
          <option value="hidden" ${state.researchMode === 'hidden' ? 'selected' : ''}>Скрытые жемчужины</option>
          <option value="consensus" ${state.researchMode === 'consensus' ? 'selected' : ''}>Общий консенсус</option>
          <option value="entities" ${state.researchMode === 'entities' ? 'selected' : ''}>Студии и авторы</option>
          <option value="personal" ${state.researchMode === 'personal' ? 'selected' : ''}>Я против большинства</option>
        </select>
        <select class="oc-discovery-control" id="oc-research-type"><option value="" ${!state.researchType ? 'selected' : ''}>OP и ED</option><option value="OP" ${state.researchType === 'OP' ? 'selected' : ''}>OP</option><option value="ED" ${state.researchType === 'ED' ? 'selected' : ''}>ED</option></select>
        <label class="oc-discovery-meta">Минимум голосов <input class="oc-discovery-control" id="oc-research-min" type="number" min="2" max="20" value="${state.researchMinVotes}" /></label>
      </div>
      <div class="oc-discovery-list">
        <h4>${esc(explanation[0])} · ${rows.length}</h4>
        ${rows.length ? rows.map((row, index) => isEntity
          ? `<div class="oc-discovery-row"><button type="button">${index + 1}. ${esc(row.name)} <small>· ${esc(row.kind)}</small></button><span>${row.weighted.toFixed(2)} · ${row.tracks.length} треков</span></div>`
          : `<div class="oc-discovery-row"><button data-discovery-open="${esc(row.entry.id)}">${index + 1}. ${esc(row.entry.title)}</button><span>${state.researchMode === 'personal' ? `ты ${row.own} · средняя ${row.average.toFixed(1)} · Δ ${row.personalDiff.toFixed(1)}` : `средняя ${row.average.toFixed(1)} · голосов ${row.count}${row.deviation === null ? '' : ` · σ ${row.deviation.toFixed(2)}`}`}</span></div>`
        ).join('') : '<div class="oc-discovery-meta">Для выбранных условий пока недостаточно данных.</div>'}
      </div>
    </section>`;
  }

  function collectionsByOwner() {
    return profiles().map(profile => ({
      owner: profileName(profile),
      rows: Array.isArray(profile.collections) ? profile.collections : []
    })).filter(group => group.owner && group.rows.length);
  }

  function ownCollections() {
    const profile = profiles().find(row => normalize(profileName(row)) === normalize(currentName()));
    return Array.isArray(profile?.collections) ? profile.collections : [];
  }

  function newCollectionDraft(existing = null) {
    state.collectionDraft = existing ? {
      id: String(existing.id),
      title: String(existing.title || ''),
      description: String(existing.description || ''),
      trackIds: Array.isArray(existing.trackIds) ? [...existing.trackIds].map(String) : [],
      createdAtLocal: existing.createdAtLocal || new Date().toISOString()
    } : {
      id: `collection_${Date.now().toString(36)}`,
      title: '',
      description: '',
      trackIds: [],
      createdAtLocal: new Date().toISOString()
    };
    state.collectionSearch = '';
    renderActive();
  }

  function collectionSearchRows() {
    const query = normalize(state.collectionSearch);
    if (query.length < 2 || !state.collectionDraft) return [];
    const selected = new Set(state.collectionDraft.trackIds.map(String));
    return entries().filter(entry => {
      if (selected.has(String(entry.id))) return false;
      return normalize([
        entry.title,
        ...(entry.alternativeTitles || []),
        ...(entry.performers || []),
        ...(entry.studios || []),
        ...(entry.directors || []),
        ...(entry.franchises || [])
      ].join(' ')).includes(query);
    }).slice(0, 12);
  }

  async function saveCollectionDraft() {
    if (!state.collectionDraft?.title.trim()) return;
    state.collectionMessage = '';
    try {
      const list = ownCollections().filter(row => String(row.id) !== String(state.collectionDraft.id));
      list.push({ ...state.collectionDraft, title: state.collectionDraft.title.trim(), description: state.collectionDraft.description.trim() });
      await bridge()?.saveCollections?.(list);
      state.collectionDraft = null;
      state.collectionMessage = 'Подборка сохранена ✓';
    } catch (error) {
      state.collectionMessage = error?.message || 'Не удалось сохранить подборку.';
      console.error(error);
    }
    renderActive();
  }

  async function deleteCollection(id) {
    state.collectionMessage = '';
    try {
      const list = ownCollections().filter(row => String(row.id) !== String(id));
      await bridge()?.saveCollections?.(list);
      if (String(state.collectionDraft?.id) === String(id)) state.collectionDraft = null;
      state.collectionMessage = 'Подборка удалена.';
    } catch (error) {
      state.collectionMessage = error?.message || 'Не удалось удалить подборку.';
      console.error(error);
    }
    renderActive();
  }

  function collectionRowsMarkup(collection) {
    const byId = duelEntries();
    return (collection.trackIds || []).map((id, index) => {
      const entry = byId.get(String(id));
      return `<div class="oc-discovery-row"><button data-discovery-open="${esc(id)}">${index + 1}. ${esc(entry?.title || 'Удалённая карточка')}</button><span>${esc(entry ? entryMeta(entry) : '')}</span></div>`;
    }).join('');
  }

  function renderCollections() {
    const groups = collectionsByOwner();
    if (!state.collectionOwner) state.collectionOwner = currentName() || groups[0]?.owner || '';
    const visibleGroup = groups.find(group => normalize(group.owner) === normalize(state.collectionOwner));
    const own = ownCollections();
    const draft = state.collectionDraft;
    const byId = duelEntries();
    const searchRows = collectionSearchRows();
    return `<section class="oc-discovery-view" data-discovery-view="collections">
      <div class="oc-discovery-head">
        <div><div class="oc-section-label">сохраняемые списки</div><h3>Пользовательские подборки</h3><p>Тематические списки не зависят от топ‑100, альбомов и угадайки. Каждая подборка видна в профиле владельца.</p></div>
        <button class="oc-discovery-button primary" id="oc-collection-new" type="button">Новая подборка</button>
      </div>
      <div class="oc-collection-editor-head">
        <label class="oc-discovery-meta">Чьи подборки <select class="oc-discovery-control" id="oc-collection-owner">${userOptions(state.collectionOwner, 'Выберите пользователя')}</select></label>
      </div>
      ${state.collectionMessage ? `<div class="oc-collection-message">${esc(state.collectionMessage)}</div>` : ''}
      <div class="oc-collections-layout">
        <div class="oc-collection-list">
          ${(visibleGroup?.rows || []).length ? visibleGroup.rows.map(collection => `<article class="oc-collection-item ${String(draft?.id) === String(collection.id) ? 'active' : ''}">
            <h4>${esc(collection.title)}</h4><p>${esc(collection.description || 'Без описания')} · ${(collection.trackIds || []).length} треков</p>
            <div class="oc-collection-item-actions">
              <button class="oc-discovery-button" type="button" data-collection-open="${esc(collection.id)}">Открыть</button>
              ${normalize(visibleGroup.owner) === normalize(currentName()) ? `<button class="oc-discovery-button" type="button" data-collection-edit="${esc(collection.id)}">Изменить</button><button class="oc-discovery-button danger" type="button" data-collection-delete="${esc(collection.id)}">Удалить</button>` : ''}
            </div>
            <div class="oc-collection-expanded hidden" data-collection-body="${esc(collection.id)}">${collectionRowsMarkup(collection)}</div>
          </article>`).join('') : '<div class="oc-discovery-empty">У этого пользователя пока нет подборок.</div>'}
        </div>
        ${draft ? `<div class="oc-collection-editor">
          <div class="oc-collection-editor-head"><h3>${own.some(row => String(row.id) === String(draft.id)) ? 'Редактирование' : 'Новая подборка'}</h3><button class="oc-discovery-button" id="oc-collection-cancel" type="button">Закрыть</button></div>
          <div class="oc-collection-fields">
            <input id="oc-collection-title" maxlength="100" value="${esc(draft.title)}" placeholder="Название подборки" />
            <textarea id="oc-collection-description" maxlength="500" rows="3" placeholder="Короткое описание">${esc(draft.description)}</textarea>
            <input id="oc-collection-search" value="${esc(state.collectionSearch)}" placeholder="Найти трек для добавления…" autocomplete="off" />
            <div class="oc-collection-search-results">${searchRows.map(entry => `<div class="oc-collection-track"><span>${esc(entry.title)} · ${esc(entryMeta(entry))}</span><button type="button" data-collection-add-track="${esc(entry.id)}">добавить</button></div>`).join('')}</div>
            <div class="oc-discovery-meta">Выбрано: ${draft.trackIds.length}</div>
            <div class="oc-collection-selected">${draft.trackIds.map(id => {
              const entry = byId.get(String(id));
              return `<div class="oc-collection-track"><span>${esc(entry?.title || id)}</span><button type="button" data-collection-remove-track="${esc(id)}">убрать</button></div>`;
            }).join('')}</div>
            <button class="oc-discovery-button primary" id="oc-collection-save" type="button" ${draft.title.trim() ? '' : 'disabled'}>Сохранить подборку</button>
          </div>
        </div>` : '<div class="oc-discovery-empty">Открой существующую подборку или создай новую.</div>'}
      </div>
    </section>`;
  }

  function formatJournalValue(value) {
    if (Array.isArray(value)) return value.join(', ') || '—';
    if (value === true) return 'да';
    if (value === false) return 'нет';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  function formatJournalDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : 'время не указано';
  }

  function renderJournal() {
    return `<section class="oc-discovery-view" data-discovery-view="journal">
      <div class="oc-discovery-head"><div><div class="oc-section-label">без автоматического отката</div><h3>Журнал каталога</h3><p>Добавления, удаления и изменения полей карточек. Если что-то внесено неправильно, администратор исправляет карточку вручную.</p></div></div>
      <div class="oc-journal-list">${state.journal.length ? state.journal.map(row => {
        const action = row.action === 'create' ? 'Добавлена' : row.action === 'delete' ? 'Удалена' : 'Изменена';
        return `<article class="oc-journal-entry">
          <div class="oc-journal-entry-head"><div><h4>${action}: ${esc(row.title)}</h4><div class="oc-discovery-meta">${esc(row.actorName || 'админ')} · ${esc(row.type || '')}</div></div><time>${esc(formatJournalDate(row.at))}</time></div>
          <div class="oc-journal-changes">${(row.changes || []).map(change => `<div class="oc-journal-change"><strong>${esc(FIELD_LABELS[change.field] || change.field)}</strong>: ${esc(formatJournalValue(change.before))} → ${esc(formatJournalValue(change.after))}</div>`).join('') || '<div class="oc-journal-change">Карточка целиком.</div>'}</div>
        </article>`;
      }).join('') : '<div class="oc-discovery-empty">Журнал пока пуст. Новые изменения карточек начнут появляться здесь автоматически.</div>'}</div>
    </section>`;
  }

  function shellMarkup(content) {
    const data = snapshot();
    return `<div class="oc-discovery-shell">
      <section class="oc-discovery-hero">
        <div><div class="oc-section-label">данные превращаются в открытия</div><h2>Открытия</h2><p>Персональные рекомендации, сравнение вкусов, дуэльный топ, исследования, подборки и история развития каталога.</p></div>
        <div class="oc-discovery-data-badge"><strong>${(data.entries || []).length}</strong><span>карточек · ${(data.ratings || []).length} загруженных оценок</span></div>
      </section>
      <nav class="oc-discovery-tabs" aria-label="Разделы открытий">${TAB_META.map(([id, label]) => `<button type="button" class="oc-discovery-tab ${state.active === id ? 'active' : ''}" data-discovery-tab="${id}">${label}</button>`).join('')}</nav>
      <div id="oc-discovery-content">${content}</div>
    </div>`;
  }

  function activeMarkup() {
    if (state.active === 'duel') return renderDuel();
    if (state.active === 'comparison') return renderComparison();
    if (state.active === 'research') return renderResearch();
    if (state.active === 'collections') return renderCollections();
    if (state.active === 'journal') return renderJournal();
    return renderRecommendations();
  }

  function render() {
    state.renderQueued = false;
    panel.innerHTML = shellMarkup(activeMarkup());
    mountImageFallbacks();
  }

  function renderActive() {
    const content = panel.querySelector('#oc-discovery-content');
    if (!content) {
      render();
      return;
    }
    content.innerHTML = activeMarkup();
    panel.querySelectorAll('[data-discovery-tab]').forEach(button => button.classList.toggle('active', button.dataset.discoveryTab === state.active));
    mountImageFallbacks(content);
  }

  function queueRender() {
    if (state.renderQueued || document.querySelector('.oc-tab-btn[data-tab="discovery"]')?.classList.contains('active') !== true) return;
    state.renderQueued = true;
    window.setTimeout(render, 60);
  }

  function ensureJournalWatcher() {
    if (state.journalUnsubscribe) return;
    state.journalUnsubscribe = bridge()?.watchJournal?.(rows => {
      state.journal = Array.isArray(rows) ? rows : [];
      if (state.active === 'journal') queueRender();
    }) || null;
  }

  panel.addEventListener('click', event => {
    const tab = event.target.closest('[data-discovery-tab]');
    if (tab) {
      state.active = String(tab.dataset.discoveryTab || 'recommendations');
      if (state.active === 'journal') ensureJournalWatcher();
      render();
      return;
    }
    const open = event.target.closest('[data-discovery-open]');
    if (open) {
      bridge()?.openTrack?.(open.dataset.discoveryOpen);
      return;
    }
    const rate = event.target.closest('[data-discovery-rate]');
    if (rate) {
      bridge()?.rateTrack?.(rate.dataset.discoveryRate);
      return;
    }
    if (event.target.closest('#oc-duel-start')) {
      startDuel();
      return;
    }
    if (event.target.closest('#oc-duel-save')) {
      void saveDuel();
      return;
    }
    const choice = event.target.closest('[data-duel-choice]');
    if (choice) {
      if (state.duel?.mode === 'refine') advanceRefineDuel(choice.dataset.duelChoice);
      else advanceNewDuel(choice.dataset.duelChoice);
      return;
    }
    if (event.target.closest('#oc-collection-new')) {
      state.collectionOwner = currentName();
      newCollectionDraft();
      return;
    }
    if (event.target.closest('#oc-collection-cancel')) {
      state.collectionDraft = null;
      renderActive();
      return;
    }
    const openCollection = event.target.closest('[data-collection-open]');
    if (openCollection) {
      const body = panel.querySelector(`[data-collection-body="${CSS.escape(openCollection.dataset.collectionOpen)}"]`);
      body?.classList.toggle('hidden');
      return;
    }
    const editCollection = event.target.closest('[data-collection-edit]');
    if (editCollection) {
      const row = ownCollections().find(item => String(item.id) === String(editCollection.dataset.collectionEdit));
      if (row) newCollectionDraft(row);
      return;
    }
    const deleteButton = event.target.closest('[data-collection-delete]');
    if (deleteButton) {
      void deleteCollection(deleteButton.dataset.collectionDelete);
      return;
    }
    const addTrack = event.target.closest('[data-collection-add-track]');
    if (addTrack && state.collectionDraft) {
      state.collectionDraft.trackIds = Array.from(new Set([...state.collectionDraft.trackIds, String(addTrack.dataset.collectionAddTrack)])).slice(0, 200);
      state.collectionSearch = '';
      renderActive();
      return;
    }
    const removeTrack = event.target.closest('[data-collection-remove-track]');
    if (removeTrack && state.collectionDraft) {
      state.collectionDraft.trackIds = state.collectionDraft.trackIds.filter(id => String(id) !== String(removeTrack.dataset.collectionRemoveTrack));
      renderActive();
      return;
    }
    if (event.target.closest('#oc-collection-save')) void saveCollectionDraft();
  });

  panel.addEventListener('change', event => {
    if (event.target.matches('#oc-discovery-recommendation-type')) {
      state.recommendationType = event.target.value;
      renderActive();
    } else if (event.target.matches('#oc-duel-type')) {
      state.duelType = event.target.value === 'ED' ? 'ED' : 'OP';
      state.duel = null;
      renderActive();
    } else if (event.target.matches('#oc-duel-mode')) {
      state.duelMode = event.target.value === 'refine' ? 'refine' : 'new';
      state.duel = null;
      renderActive();
    } else if (event.target.matches('#oc-compare-a')) {
      state.comparisonA = event.target.value;
      renderActive();
    } else if (event.target.matches('#oc-compare-b')) {
      state.comparisonB = event.target.value;
      renderActive();
    } else if (event.target.matches('#oc-research-mode')) {
      state.researchMode = event.target.value;
      renderActive();
    } else if (event.target.matches('#oc-research-type')) {
      state.researchType = event.target.value;
      renderActive();
    } else if (event.target.matches('#oc-research-min')) {
      state.researchMinVotes = Math.max(2, Math.min(20, Number(event.target.value) || 3));
      renderActive();
    } else if (event.target.matches('#oc-collection-owner')) {
      state.collectionOwner = event.target.value;
      state.collectionDraft = null;
      renderActive();
    }
  });

  panel.addEventListener('input', event => {
    if (!state.collectionDraft) return;
    if (event.target.matches('#oc-collection-title')) {
      state.collectionDraft.title = event.target.value;
      const save = panel.querySelector('#oc-collection-save');
      if (save) save.disabled = !state.collectionDraft.title.trim();
    } else if (event.target.matches('#oc-collection-description')) {
      state.collectionDraft.description = event.target.value;
    } else if (event.target.matches('#oc-collection-search')) {
      state.collectionSearch = event.target.value;
      window.clearTimeout(state.collectionSearchTimer);
      state.collectionSearchTimer = window.setTimeout(renderActive, 180);
    }
  });

  window.addEventListener('oped:app-data-updated', () => {
    ensureJournalWatcher();
    queueRender();
  });
  window.addEventListener('oped:route-change', event => {
    if (event.detail?.tab === 'discovery') {
      ensureJournalWatcher();
      render();
    }
  });

  if (document.querySelector('.oc-tab-btn[data-tab="discovery"]')?.classList.contains('active')) {
    ensureJournalWatcher();
    render();
  }
})();
