(() => {
  const panel = document.querySelector('.oc-addbar');
  if (!panel || panel.dataset.trackPanelUpgraded === '1') return;

  const byId = id => document.getElementById(id);
  const controls = {
    title: byId('oc-add-title'),
    type: byId('oc-add-type'),
    year: byId('oc-add-year'),
    season: byId('oc-add-season'),
    studio: byId('oc-add-studio'),
    director: byId('oc-add-director'),
    performer: byId('oc-add-performer'),
    sameSong: byId('oc-add-same-song'),
    franchise: byId('oc-add-franchise'),
    image: byId('oc-add-image'),
    fallbackImage: byId('oc-add-fallback-image'),
    link: byId('oc-add-link'),
    altTitles: byId('oc-add-alt-titles')
  };

  if (Object.values(controls).some(control => !control)) return;

  const makeField = (control, label, options = {}) => {
    const wrapper = document.createElement('label');
    wrapper.className = `oc-add-field${options.wide ? ' oc-add-field-wide' : ''}`;
    wrapper.htmlFor = control.id;

    const caption = document.createElement('span');
    caption.className = 'oc-add-field-label';
    caption.textContent = label;

    if (options.hint) {
      const hint = document.createElement('em');
      hint.textContent = options.hint;
      caption.append(hint);
    }

    wrapper.append(caption, control);
    return wrapper;
  };

  const makeSection = ({ className, icon, title, note, fields }) => {
    const section = document.createElement('section');
    section.className = `oc-add-section ${className}`;

    const head = document.createElement('div');
    head.className = 'oc-add-section-head';

    const heading = document.createElement('h3');
    heading.className = 'oc-add-section-title';
    const badge = document.createElement('i');
    badge.textContent = icon;
    const headingText = document.createElement('span');
    headingText.textContent = title;
    heading.append(badge, headingText);

    const description = document.createElement('p');
    description.className = 'oc-add-section-note';
    description.textContent = note;
    head.append(heading, description);

    const grid = document.createElement('div');
    grid.className = `oc-add-fields ${className.replace('oc-add-section-', 'oc-add-fields-')}`;
    fields.forEach(field => grid.append(field));

    section.append(head, grid);
    return section;
  };

  controls.title.placeholder = 'Например: Frieren — OP 1';
  controls.year.placeholder = '2026';
  controls.studio.placeholder = 'Madhouse, MAPPA';
  controls.director.placeholder = 'Имена через запятую';
  controls.performer.placeholder = 'Исполнители через запятую';
  controls.sameSong.placeholder = 'Общее название для двух версий';
  controls.franchise.placeholder = 'Одна франшиза на строку';
  controls.image.placeholder = 'https://…/poster.webp';
  controls.fallbackImage.placeholder = 'images/название.webp';
  controls.link.placeholder = 'Ссылка на видео или AniSongDB';
  controls.altTitles.placeholder = 'Каждое название с новой строки или через ;';

  const layout = document.createElement('div');
  layout.className = 'oc-add-layout';
  layout.append(
    makeSection({
      className: 'oc-add-section-main',
      icon: '01',
      title: 'Основная информация',
      note: 'Название, тип и сезон определяют, где трек появится в каталоге.',
      fields: [
        makeField(controls.title, 'Название трека', { hint: 'обязательно' }),
        makeField(controls.type, 'Тип', { hint: 'OP / ED' }),
        makeField(controls.year, 'Год'),
        makeField(controls.season, 'Сезон')
      ]
    }),
    makeSection({
      className: 'oc-add-section-relations',
      icon: '02',
      title: 'Связи и каталогизация',
      note: 'Эти поля формируют альбомы студий, исполнителей, режиссёров и франшиз.',
      fields: [
        makeField(controls.studio, 'Студии', { hint: 'через запятую' }),
        makeField(controls.director, 'Режиссёры', { hint: 'через запятую' }),
        makeField(controls.performer, 'Исполнители', { hint: 'через запятую' }),
        makeField(controls.sameSong, 'Одинаковая песня', { hint: 'необязательно' }),
        makeField(controls.franchise, 'Франшизы', { hint: 'одна на строку', wide: true })
      ]
    }),
    makeSection({
      className: 'oc-add-section-media',
      icon: '03',
      title: 'Изображения и ссылки',
      note: 'Основная картинка используется в карточке, запасная — если внешний URL недоступен.',
      fields: [
        makeField(controls.image, 'Основная картинка'),
        makeField(controls.fallbackImage, 'Запасная картинка'),
        makeField(controls.link, 'Ссылка на трек', { wide: true }),
        makeField(controls.altTitles, 'Альтернативные названия', { hint: 'для поиска', wide: true })
      ]
    })
  );

  const oldGrid = panel.querySelector('.oc-addgrid');
  const oldGrid2 = panel.querySelector('.oc-addgrid2');
  const oldAltRow = panel.querySelector('.oc-add-alt-row');
  const extraRow = panel.querySelector('.oc-add-extra-row');

  if (extraRow) panel.insertBefore(layout, extraRow);
  else panel.append(layout);

  oldGrid?.remove();
  oldGrid2?.remove();
  oldAltRow?.remove();

  const addButton = byId('oc-add-btn');
  if (addButton) addButton.textContent = 'Добавить трек';

  const hint = panel.querySelector('.oc-hint');
  if (hint) hint.textContent = 'Подсказки подставляются из уже существующих данных. Названия с запятыми для франшиз вводи отдельными строками.';

  panel.classList.add('oc-addbar-v2');
  panel.dataset.trackPanelUpgraded = '1';
})();
