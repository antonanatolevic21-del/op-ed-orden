(() => {
  if (window.__OC_HELP_TOUR_READY__) return;
  window.__OC_HELP_TOUR_READY__ = true;

  const routes = {
    chart: {
      label: 'Общий чарт и каталог',
      tab: 'chart',
      steps: [
        { selectors: ['.oc-topbar'], title: 'Аккаунт и быстрые действия', text: 'Здесь выбирается профиль, открывается ежедневная оценка и находится окно выбора аватарки.' },
        { selectors: ['.oc-tabs'], title: 'Основные разделы', text: 'Эта строка переключает каталог, профиль, сезоны, переоценку, рейтинги и статистику.' },
        { selectors: ['.oc-home-collections'], title: 'Коллекции', text: 'Быстрый переход к трекам конкретной студии, исполнителя, режиссёра или франшизы.' },
        { selectors: ['.oc-filterbar'], title: 'Поиск и фильтры', text: 'Ищи по названию и связанным данным, сочетай несколько фильтров и меняй сортировку каталога.' },
        { selectors: ['#oc-list-container'], title: 'Каталог треков', text: 'Нажатие на карточку открывает подробности и оценивание. Ссылки и связанные сущности можно открывать отдельно.' }
      ]
    },
    'profile-overview': {
      label: 'Профиль · Обзор',
      tab: 'profile',
      profileView: 'overview',
      steps: [
        { selectors: ['.oc-profile-select-wrap'], title: 'Чей профиль открыт', text: 'Переключай пользователя, чтобы смотреть его оценки, топы и статистику.' },
        { selectors: ['.oc-profile-subtabs'], title: 'Разделы профиля', text: 'Обзор, личный топ, все оценки, сравнение вкусов, дейлики и ивенты разделены по вкладкам.' },
        { selectors: ['#oc-profile-stats'], title: 'Ключевые показатели', text: 'Здесь собраны средние оценки, прогресс и сильнейшие категории выбранного профиля.' }
      ]
    },
    'profile-top100': {
      label: 'Профиль · Мой топ-100',
      tab: 'profile',
      profileView: 'top100',
      steps: [
        { selectors: ['.oc-profile-subtabs'], title: 'Мой топ-100', text: 'Это отдельный раздел профиля; он не смешивается со слепой переоценкой.' },
        { selectors: ['.oc-profile-filterbar'], title: 'Фильтры кандидатов', text: 'Фильтры помогают быстро сузить список треков при работе с личным топом.' },
        { selectors: ['.oc-manual-actions'], title: 'Редактирование и сохранение', text: 'Включи редактирование, измени позиции и обязательно сохрани топ, чтобы он стал виден всем.' },
        { selectors: ['.oc-profile-columns'], title: 'Отдельные топы OP и ED', text: 'Опенинги и эндинги ранжируются независимо; позицию можно менять вручную.' }
      ]
    },
    'profile-ratings': {
      label: 'Профиль · Все оценки',
      tab: 'profile',
      profileView: 'ratings',
      steps: [
        { selectors: ['.oc-profile-filterbar'], title: 'Общие фильтры профиля', text: 'Эти фильтры применяются и к списку всех оценок ниже.' },
        { selectors: ['.oc-allratings-controls'], title: 'Вид и сортировка оценок', text: 'Выбери OP/ED, общую или детальную оценку, конкретный балл и порядок — включая последние поставленные оценки.' },
        { selectors: ['#oc-allratings-columns'], title: 'Все оценки', text: 'OP и ED показаны отдельно. Карточка открывает подробности; в своём профиле оценку можно удалить.' }
      ]
    },
    'profile-comparison': {
      label: 'Профиль · Сравнение вкусов',
      tab: 'profile',
      profileView: 'comparison',
      steps: [
        { selectors: ['.oc-profile-subtabs'], title: 'Сравнение вкусов', text: 'Раздел сопоставляет оценки выбранного профиля с другими пользователями.' },
        { selectors: ['#oc-profile-taste-comparison', '#oc-profile-panel'], title: 'Совпадения и расхождения', text: 'Смотри общие оценённые треки, близость вкусов и позиции с самым заметным расхождением.' }
      ]
    },
    'profile-daily': {
      label: 'Профиль · Дейлики',
      tab: 'profile',
      profileView: 'daily',
      steps: [
        { selectors: ['#oc-daily-panel', '.oc-profile-daily-placeholder'], title: 'Ежедневная оценка', text: 'Здесь настраивается и отслеживается личная ежедневная подборка. Уже оценённые треки не участвуют в новом отборе.' },
        { selectors: ['#oc-daily-bell'], title: 'Быстрый вход в дейлик', text: 'Колокольчик в верхней панели открывает текущую ежедневную подборку из любого раздела.' }
      ]
    },
    'profile-events': {
      label: 'Профиль · Мои ивенты',
      tab: 'profile',
      profileView: 'events',
      steps: [
        { selectors: ['#oc-my-events-panel', '#oc-profile-panel'], title: 'Мои ивенты', text: 'Здесь собраны созданные тобой события и те, в которых ты участвуешь.' },
        { selectors: ['.oc-profile-subtabs'], title: 'Возврат в профиль', text: 'Остальные данные профиля остаются в соседних вкладках и не смешиваются с ивентами.' }
      ]
    },
    rerating: {
      label: 'Слепая переоценка',
      tab: 'rerating',
      steps: [
        { selectors: ['.oc-rerating-page'], title: 'Слепая переоценка', text: 'Старые баллы скрыты до новой оценки. После сравнения ты отдельно решаешь, сохранять изменение или оставить прежний результат.' },
        { selectors: ['#oc-blind-rerate-btn'], title: 'Начать сессию', text: 'Кнопка создаёт случайную выборку уже оценённых треков и запускает последовательную переоценку.' }
      ]
    },
    discovery: {
      label: 'Открытия',
      tab: 'discovery',
      steps: [
        { selectors: ['#oc-discovery-panel'], title: 'Открытия', text: 'Раздел помогает находить ещё не оценённые треки через подборки, связи и историю твоих оценок.' }
      ]
    },
    top100: {
      label: 'Общий топ-100',
      tab: 'top100',
      steps: [
        { selectors: ['.oc-globaltop-controls'], title: 'Режим общего топа', text: 'Переключай OP/ED и способ расчёта: по ручным топам пользователей или по среднему баллу.' },
        { selectors: ['#oc-globaltop-summary'], title: 'Условия выборки', text: 'Краткая сводка показывает, какие данные вошли в текущий рейтинг.' },
        { selectors: ['#oc-globaltop-list'], title: 'Итоговый рейтинг', text: 'Карточки расположены по выбранному режиму; нажатие открывает подробности трека.' }
      ]
    },
    season: {
      label: 'Сезоны OP/ED',
      tab: 'season',
      steps: [
        { selectors: ['#oc-season-years'], title: 'Год и сезон', text: 'Сначала выбери год слева, затем нужный сезон.' },
        { selectors: ['.oc-season-type-toggle'], title: 'Опенинги или эндинги', text: 'Списки и массовое оценивание переключаются отдельно для OP и ED.' },
        { selectors: ['.oc-season-head-actions'], title: 'Действия сезона', text: 'Можно перейти к соседнему сезону, открыть тир-лист или запустить последовательную оценку всего списка.' },
        { selectors: ['#oc-season-list'], title: 'Треки сезона', text: 'Здесь видны все найденные треки выбранного типа и сезона.' }
      ]
    },
    tier: {
      label: 'Тир-лист',
      tab: 'tier',
      steps: [
        { selectors: ['.oc-tier-controls'], title: 'Параметры тир-листа', text: 'Выбери OP/ED, год и сезон; готовый результат можно скачать.' },
        { selectors: ['#oc-tier-list'], title: 'Ряды оценок', text: 'Карточки автоматически попадают в ряд своего балла. Внутри ряда их можно переставлять.' }
      ]
    },
    stats: {
      label: 'Средние',
      tab: 'stats',
      steps: [
        { selectors: ['#oc-stats-type'], title: 'Тип треков', text: 'Статистику можно смотреть вместе или отдельно для OP и ED.' },
        { selectors: ['.oc-stats-grid'], title: 'Средние по категориям', text: 'Сравнивай исполнителей, режиссёров, студии, франшизы и сезоны. Порог данных защищает таблицу от случайных единичных оценок.' }
      ]
    },
    avatar: {
      label: 'Окно выбора аватарки',
      steps: [
        { selectors: ['#oc-avatar-btn'], title: 'Текущая аватарка', text: 'Кнопка в правом верхнем углу открывает выбор изображения для активного аккаунта.' },
        { selectors: ['#oc-avatar-picker'], title: 'Выбор аватарки', text: 'Нажми на подходящий вариант — он сохранится в профиле и будет использоваться рядом с твоими оценками.' }
      ]
    }
  };

  let chooser = null;
  let tourRoot = null;
  let activeSteps = [];
  let activeIndex = 0;
  let repositionHandler = null;

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const isVisible = element => {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const firstVisible = selectors => selectors.map(selector => document.querySelector(selector)).find(isVisible) || null;

  function currentRoute() {
    const activeTab = document.querySelector('.oc-tab-btn.active[data-tab]')?.dataset.tab || 'chart';
    if (activeTab !== 'profile') return routes[activeTab] ? activeTab : 'chart';
    const view = document.querySelector('#oc-profile-panel')?.dataset.profileView
      || document.querySelector('.oc-profile-subtabs [data-profile-view].active')?.dataset.profileView
      || 'overview';
    return routes[`profile-${view}`] ? `profile-${view}` : 'profile-overview';
  }

  function closeChooser() {
    chooser?.remove();
    chooser = null;
  }

  function closeTour() {
    if (repositionHandler) {
      window.removeEventListener('resize', repositionHandler);
      window.removeEventListener('scroll', repositionHandler, true);
    }
    repositionHandler = null;
    tourRoot?.remove();
    tourRoot = null;
    activeSteps = [];
    document.querySelector('#oc-avatar-picker')?.classList.remove('oc-help-tour-picker');
  }

  function showChooser() {
    closeTour();
    closeChooser();
    chooser = document.createElement('div');
    chooser.className = 'oc-help-chooser-backdrop';
    chooser.innerHTML = `
      <section class="oc-help-chooser" role="dialog" aria-modal="true" aria-labelledby="oc-help-title">
        <button type="button" class="oc-help-close" data-help-close aria-label="Закрыть">×</button>
        <div class="oc-help-kicker">помощь по сайту</div>
        <h2 id="oc-help-title">Хотите уточнить возможности?</h2>
        <p>Выберите раздел — подсветим основные блоки и коротко объясним, как ими пользоваться.</p>
        <label>
          <span>Какую вкладку разобрать</span>
          <select data-help-route>
            ${Object.entries(routes).map(([id, route]) => `<option value="${id}">${route.label}</option>`).join('')}
          </select>
        </label>
        <div class="oc-help-chooser-actions">
          <button type="button" data-help-close>Не сейчас</button>
          <button type="button" class="primary" data-help-start>Да, показать</button>
        </div>
      </section>`;
    document.body.append(chooser);
    const select = chooser.querySelector('[data-help-route]');
    select.value = currentRoute();
    chooser.addEventListener('click', event => {
      if (event.target === chooser || event.target.closest('[data-help-close]')) closeChooser();
      const start = event.target.closest('[data-help-start]');
      if (start) void beginGuide(select.value, start);
    });
    select.focus();
  }

  async function waitFor(selector, timeout = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await sleep(80);
    }
    return null;
  }

  async function navigateTo(route) {
    if (route.tab) {
      const tab = document.querySelector(`.oc-tab-btn[data-tab="${route.tab}"]`);
      if (tab && !tab.classList.contains('active')) {
        tab.click();
        await sleep(220);
      }
    }
    if (route.profileView) {
      await waitFor('.oc-profile-subtabs [data-profile-view]');
      const view = document.querySelector(`.oc-profile-subtabs [data-profile-view="${route.profileView}"]`);
      if (view && !view.classList.contains('active')) {
        view.click();
        await sleep(220);
      }
    }
    if (route === routes.avatar) {
      const picker = document.querySelector('#oc-avatar-picker');
      if (picker?.classList.contains('hidden')) {
        document.querySelector('#oc-avatar-btn')?.click();
        await sleep(120);
      }
      picker?.classList.add('oc-help-tour-picker');
    }
  }

  async function beginGuide(id, button) {
    const route = routes[id] || routes.chart;
    button.disabled = true;
    button.textContent = 'Открываю раздел…';
    await navigateTo(route);
    closeChooser();
    activeSteps = route.steps.filter(step => firstVisible(step.selectors));
    if (!activeSteps.length) {
      showChooser();
      const title = chooser?.querySelector('#oc-help-title');
      if (title) title.textContent = 'Этот раздел ещё загружается';
      return;
    }
    activeIndex = 0;
    renderStep();
  }

  function positionStep() {
    if (!tourRoot) return;
    const step = activeSteps[activeIndex];
    const target = firstVisible(step.selectors);
    if (!target) {
      if (activeIndex < activeSteps.length - 1) {
        activeIndex += 1;
        renderStep();
      } else closeTour();
      return;
    }
    const rect = target.getBoundingClientRect();
    const highlight = tourRoot.querySelector('.oc-help-highlight');
    const bubble = tourRoot.querySelector('.oc-help-bubble');
    const pad = 7;
    highlight.style.left = `${Math.max(5, rect.left - pad)}px`;
    highlight.style.top = `${Math.max(5, rect.top - pad)}px`;
    highlight.style.width = `${Math.min(window.innerWidth - 10, rect.width + pad * 2)}px`;
    highlight.style.height = `${Math.min(window.innerHeight - 10, rect.height + pad * 2)}px`;

    const bubbleWidth = Math.min(370, window.innerWidth - 24);
    bubble.style.width = `${bubbleWidth}px`;
    const bubbleHeight = bubble.offsetHeight || 210;
    const below = rect.bottom + 16;
    const top = below + bubbleHeight <= window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - bubbleHeight - 16);
    const left = Math.max(12, Math.min(window.innerWidth - bubbleWidth - 12, rect.left + rect.width / 2 - bubbleWidth / 2));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function renderStep() {
    const step = activeSteps[activeIndex];
    const target = firstVisible(step.selectors);
    if (!target) {
      positionStep();
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    if (!tourRoot) {
      tourRoot = document.createElement('div');
      tourRoot.className = 'oc-help-tour';
      tourRoot.innerHTML = '<div class="oc-help-highlight"></div><section class="oc-help-bubble" role="dialog" aria-live="polite"></section>';
      document.body.append(tourRoot);
      repositionHandler = () => positionStep();
      window.addEventListener('resize', repositionHandler);
      window.addEventListener('scroll', repositionHandler, true);
    }
    const bubble = tourRoot.querySelector('.oc-help-bubble');
    bubble.innerHTML = `
      <div class="oc-help-step-count">шаг ${activeIndex + 1} из ${activeSteps.length}</div>
      <h3>${step.title}</h3>
      <p>${step.text}</p>
      <div class="oc-help-step-actions">
        <button type="button" data-help-prev ${activeIndex === 0 ? 'disabled' : ''}>Назад</button>
        <button type="button" data-help-stop>Закрыть</button>
        <button type="button" class="primary" data-help-next>${activeIndex === activeSteps.length - 1 ? 'Готово' : 'Далее'}</button>
      </div>`;
    bubble.onclick = event => {
      if (event.target.closest('[data-help-stop]')) closeTour();
      if (event.target.closest('[data-help-prev]') && activeIndex > 0) {
        activeIndex -= 1;
        renderStep();
      }
      if (event.target.closest('[data-help-next]')) {
        if (activeIndex >= activeSteps.length - 1) closeTour();
        else {
          activeIndex += 1;
          renderStep();
        }
      }
    };
    window.setTimeout(positionStep, 180);
  }

  function ensureBackToTop() {
    let button = document.querySelector('#oc-back-to-top');
    if (!button) {
      button = document.createElement('button');
      button.id = 'oc-back-to-top';
      button.className = 'oc-back-to-top';
      button.type = 'button';
      button.textContent = '↑';
      button.title = 'Наверх';
      button.setAttribute('aria-label', 'Наверх');
      document.body.append(button);
    }
    if (button.dataset.backToTopGuard !== '1') {
      button.dataset.backToTopGuard = '1';
      button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
      const sync = () => button.classList.toggle('visible', window.scrollY > 700);
      window.addEventListener('scroll', sync, { passive: true });
      sync();
    }
    return button;
  }

  ensureBackToTop();
  window.setTimeout(ensureBackToTop, 600);

  const helpButton = document.createElement('button');
  helpButton.type = 'button';
  helpButton.className = 'oc-help-launcher';
  helpButton.setAttribute('aria-label', 'Подсказка по возможностям сайта');
  helpButton.title = 'Подсказка по возможностям сайта';
  helpButton.textContent = '?';
  helpButton.hidden = true;
  helpButton.addEventListener('click', showChooser);
  document.body.append(helpButton);

  function syncAdminVisibility() {
    const badge = document.querySelector('#oc-access-badge');
    const admin = Boolean(
      badge
      && badge.classList.contains('admin')
      && String(badge.textContent || '').trim().toLocaleLowerCase('ru') === 'админ'
    );
    helpButton.hidden = !admin;
    if (!admin) {
      closeChooser();
      closeTour();
    }
  }

  const accessBadge = document.querySelector('#oc-access-badge');
  if (accessBadge) {
    new MutationObserver(syncAdminVisibility).observe(accessBadge, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true,
      subtree: true
    });
  }
  syncAdminVisibility();

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeChooser();
      closeTour();
    }
  });
})();
