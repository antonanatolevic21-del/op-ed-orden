(() => {
  const panel = document.querySelector('.oc-addbar');
  if (!panel) return;

  const placeholders = {
    'oc-add-title': 'Название (аниме — OP/ED N)',
    'oc-add-year': 'Год (напр. 2024)',
    'oc-add-studio': 'Студии (через запятую)',
    'oc-add-director': 'Режиссёры опа (через запятую)',
    'oc-add-performer': 'Исполнители (через запятую)',
    'oc-add-same-song': 'Одинаковая песня — общее название',
    'oc-add-franchise': 'Франшизы: одна строка = одна франшиза. Заполняется только вручную',
    'oc-add-image': 'Основная картинка / постер (URL)',
    'oc-add-fallback-image': 'Запасная картинка (например images/название.webp)',
    'oc-add-link': 'Ссылка (anisongdb.com и т.п.)',
    'oc-add-alt-titles': 'Альтернативные названия — каждое с новой строки или через ;. Можно оставить пустым'
  };

  Object.entries(placeholders).forEach(([id, placeholder]) => {
    const control = document.getElementById(id);
    if (control) control.placeholder = placeholder;
  });

  const head = panel.querySelector('.oc-addbar-head');
  if (head) {
    const title = document.createElement('div');
    title.className = 'oc-section-label oc-addbar-compact-title';
    title.textContent = '+ ДОБАВИТЬ ТРЕК';
    head.replaceChildren(title);
  }

  const addButton = document.getElementById('oc-add-btn');
  if (addButton) addButton.textContent = 'Добавить';

  const hint = panel.querySelector('.oc-hint');
  if (hint) {
    hint.textContent = 'Студии/режиссёры/исполнители — через запятую. Франшизы — по одной на строку, чтобы названия с запятой не дробились.';
  }

  panel.classList.remove('oc-addbar-v2');
  panel.classList.add('oc-addbar-compact');
  panel.dataset.trackPanelUpgraded = 'compact';
})();