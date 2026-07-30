(() => {
  if (window.__OC_PROFILE_TASTE_COMPARISON_READY__) return;
  window.__OC_PROFILE_TASTE_COMPARISON_READY__ = true;

  let firstUser = '';
  let secondUser = '';

  function root() {
    return document.querySelector('#oc-profile-taste-comparison');
  }

  function snapshot() {
    return window.OC_APP_BRIDGE?.snapshot?.() || window.OC_APP_DATA || {
      entries: [],
      userProfiles: [],
      currentUser: {}
    };
  }

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
      if (key.startsWith('__') || normalize(key) !== target) continue;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    return null;
  }

  function score(entry, user) {
    return valueForUser(entry?.scores, user);
  }

  function allUsers() {
    const names = new Map();
    (snapshot().userProfiles || []).forEach(profile => {
      const name = profileName(profile);
      if (name) names.set(normalize(name), name);
    });
    (snapshot().entries || []).forEach(entry => {
      Object.keys(entry?.scores || {}).forEach(name => {
        if (name && !name.startsWith('__')) names.set(normalize(name), name);
      });
    });
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }));
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function pearson(rows) {
    if (rows.length < 2) return 0;
    const averageA = mean(rows.map(row => row.a));
    const averageB = mean(rows.map(row => row.b));
    let numerator = 0;
    let squareA = 0;
    let squareB = 0;
    rows.forEach(row => {
      const left = row.a - averageA;
      const right = row.b - averageB;
      numerator += left * right;
      squareA += left * left;
      squareB += right * right;
    });
    const denominator = Math.sqrt(squareA * squareB);
    return denominator ? numerator / denominator : 0;
  }

  function highRatedEntities(user) {
    const counts = new Map();
    (snapshot().entries || []).forEach(entry => {
      const value = score(entry, user);
      if (value === null || value < 8) return;
      [
        ...(entry.studios || []),
        ...(entry.directors || []),
        ...(entry.performers || []),
        ...(entry.franchises || [])
      ].forEach(name => {
        const key = normalize(name);
        if (!key) return;
        counts.set(key, { name, count: (counts.get(key)?.count || 0) + 1 });
      });
    });
    return [...counts.values()].filter(row => row.count >= 2).sort((a, b) => b.count - a.count);
  }

  function comparisonData(a, b) {
    const shared = [];
    const onlyA = [];
    const onlyB = [];
    (snapshot().entries || []).forEach(entry => {
      const left = score(entry, a);
      const right = score(entry, b);
      if (left !== null && right !== null) {
        shared.push({ entry, a: left, b: right, diff: Math.abs(left - right) });
      } else if (left !== null && left >= 8) {
        onlyA.push({ entry, value: left });
      } else if (right !== null && right >= 8) {
        onlyB.push({ entry, value: right });
      }
    });
    shared.sort((left, right) => right.diff - left.diff);
    onlyA.sort((left, right) => right.value - left.value);
    onlyB.sort((left, right) => right.value - left.value);
    const entitiesB = new Set(highRatedEntities(b).map(row => normalize(row.name)));
    return {
      shared,
      onlyA,
      onlyB,
      correlation: shared.length >= 2 ? pearson(shared) : 0,
      averageDiff: mean(shared.map(row => row.diff)),
      agreements: shared.filter(row => row.diff <= .5).sort((left, right) => (right.a + right.b) - (left.a + left.b)),
      commonEntities: highRatedEntities(a).filter(row => entitiesB.has(normalize(row.name))).slice(0, 12)
    };
  }

  function options(selected, placeholder) {
    return `<option value="">${esc(placeholder)}</option>` + allUsers().map(name =>
      `<option value="${esc(name)}" ${normalize(name) === normalize(selected) ? 'selected' : ''}>${esc(name)}</option>`
    ).join('');
  }

  function rows(title, values, mapper) {
    return `<div class="oc-discovery-list"><h4>${esc(title)}</h4>${values.length
      ? values.slice(0, 14).map(mapper).join('')
      : '<div class="oc-discovery-meta">Пока нет подходящих треков.</div>'}</div>`;
  }

  function render() {
    const host = root();
    if (!host) return;
    const users = allUsers();
    const current = String(snapshot().currentUser?.nickname || '').trim();
    if (!firstUser || !users.some(name => normalize(name) === normalize(firstUser))) {
      firstUser = current || users[0] || '';
    }
    if (!secondUser || normalize(secondUser) === normalize(firstUser) || !users.some(name => normalize(name) === normalize(secondUser))) {
      secondUser = users.find(name => normalize(name) !== normalize(firstUser)) || '';
    }
    const data = firstUser && secondUser ? comparisonData(firstUser, secondUser) : null;
    const compatibility = data ? Math.max(0, Math.min(100, Math.round((data.correlation + 1) * 50))) : 0;

    host.innerHTML = `<div class="oc-discovery-view">
      <div class="oc-discovery-head">
        <div><div class="oc-section-label">вся история оценок</div><h3>Сравнение вкусов</h3><p>Совпадения, расхождения и рекомендации на основе всех общих оценок, а не только топ‑100.</p></div>
      </div>
      <div class="oc-compare-controls">
        <select class="oc-discovery-control" id="oc-profile-compare-a">${options(firstUser, 'Первый пользователь')}</select>
        <span>и</span>
        <select class="oc-discovery-control" id="oc-profile-compare-b">${options(secondUser, 'Второй пользователь')}</select>
      </div>
      ${data ? `<div class="oc-compare-summary">
        <div class="oc-discovery-metric"><span>Совместимость</span><strong>${compatibility}%</strong><small>корреляция оценок</small></div>
        <div class="oc-discovery-metric"><span>Общих оценок</span><strong>${data.shared.length}</strong><small>для сравнения</small></div>
        <div class="oc-discovery-metric"><span>Среднее расхождение</span><strong>${data.averageDiff === null ? '—' : data.averageDiff.toFixed(2)}</strong><small>балла</small></div>
        <div class="oc-discovery-metric"><span>Почти одинаково</span><strong>${data.agreements.length}</strong><small>разница не больше 0.5</small></div>
      </div>
      <div class="oc-compare-columns">
        ${rows('Самые большие расхождения', data.shared, row => `<div class="oc-discovery-row"><button type="button" data-profile-compare-open="${esc(row.entry.id)}">${esc(row.entry.title)}</button><span>${row.a} ↔ ${row.b} · Δ ${row.diff.toFixed(1)}</span></div>`)}
        ${rows('Общие любимые связи', data.commonEntities, row => `<div class="oc-discovery-row"><button type="button">${esc(row.name)}</button><span>любят оба · ${row.count}</span></div>`)}
        ${rows(`${firstUser} рекомендует`, data.onlyA, row => `<div class="oc-discovery-row"><button type="button" data-profile-compare-open="${esc(row.entry.id)}">${esc(row.entry.title)}</button><span>${row.value} · у второго нет оценки</span></div>`)}
        ${rows(`${secondUser} рекомендует`, data.onlyB, row => `<div class="oc-discovery-row"><button type="button" data-profile-compare-open="${esc(row.entry.id)}">${esc(row.entry.title)}</button><span>${row.value} · у первого нет оценки</span></div>`)}
      </div>` : '<div class="oc-discovery-empty">Для сравнения нужны хотя бы два пользователя.</div>'}
    </div>`;
  }

  document.addEventListener('change', event => {
    if (event.target.matches('#oc-profile-compare-a')) {
      firstUser = event.target.value;
      render();
    } else if (event.target.matches('#oc-profile-compare-b')) {
      secondUser = event.target.value;
      render();
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-profile-compare-open]');
    if (button) window.OC_APP_BRIDGE?.openTrack?.(button.dataset.profileCompareOpen);
  });

  window.addEventListener('oped:profile-comparison-open', render);
  window.addEventListener('oped:app-data-updated', () => {
    if (document.querySelector('#oc-profile-panel')?.dataset.profileView === 'comparison') render();
  });

  if (document.querySelector('#oc-profile-panel')?.dataset.profileView === 'comparison') render();
})();
