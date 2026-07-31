(() => {
  const params = new URLSearchParams(window.location.search);
  const workspace = params.get('adminWorkspace') === '1'
    && window.parent !== window
    && window.frameElement?.id === 'oc-admin-workspace';
  window.OC_CATALOG_ADMIN_WORKSPACE = workspace;
  document.documentElement.classList.toggle('oc-catalog-admin-workspace', workspace);

  if (!window.__OC_OP_PRIORITY_SORT_READY__) {
    window.__OC_OP_PRIORITY_SORT_READY__ = true;

    const nativeSort = Array.prototype.sort;
    const nativeToSorted = Array.prototype.toSorted;
    const TRACK_WRAPPERS = ['entry', 'e', 'opening', 'track', 'row', 'item'];

    function normalizeTitle(value) {
      return String(value || '')
        .trim()
        .toLocaleLowerCase('ru')
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
    }

    function trackInfo(value) {
      if (!value || typeof value !== 'object') return null;
      const candidates = [value];
      TRACK_WRAPPERS.forEach(key => {
        if (value[key] && typeof value[key] === 'object') candidates.push(value[key]);
      });

      for (const candidate of candidates) {
        const type = String(candidate?.type || candidate?.openingType || '').trim().toUpperCase();
        if (type !== 'OP' && type !== 'ED') continue;
        return {
          type,
          title: normalizeTitle(candidate?.title || candidate?.anime || candidate?.name || '')
        };
      }
      return null;
    }

    function typePriority(left, right) {
      if (!left || !right || left.type === right.type) return 0;
      return left.type === 'OP' ? -1 : 1;
    }

    function prioritizedComparator(compareFn) {
      return (left, right) => {
        const leftTrack = trackInfo(left);
        const rightTrack = trackInfo(right);
        const sameTitle = Boolean(
          leftTrack?.title
          && rightTrack?.title
          && leftTrack.title === rightTrack.title
        );

        if (sameTitle) {
          const titleTypeDiff = typePriority(leftTrack, rightTrack);
          if (titleTypeDiff) return titleTypeDiff;
        }

        const compared = Number(compareFn(left, right));
        if (Number.isFinite(compared) && compared !== 0) return compared;
        return typePriority(leftTrack, rightTrack);
      };
    }

    function hasTracks(values) {
      for (let index = 0; index < values.length; index += 1) {
        if (trackInfo(values[index])) return true;
      }
      return false;
    }

    Array.prototype.sort = function(compareFn) {
      if (typeof compareFn !== 'function' || !hasTracks(this)) {
        return typeof compareFn === 'function'
          ? nativeSort.call(this, compareFn)
          : nativeSort.call(this);
      }
      return nativeSort.call(this, prioritizedComparator(compareFn));
    };

    if (typeof nativeToSorted === 'function') {
      Array.prototype.toSorted = function(compareFn) {
        if (typeof compareFn !== 'function' || !hasTracks(this)) {
          return typeof compareFn === 'function'
            ? nativeToSorted.call(this, compareFn)
            : nativeToSorted.call(this);
        }
        return nativeToSorted.call(this, prioritizedComparator(compareFn));
      };
    }
  }

  function installAlbumTrackSearch() {
    const input = document.querySelector('#oc-entity-search');
    const label = input?.closest('.oc-entity-search-field');
    const filters = document.querySelector('#oc-entity-filters');
    const fields = filters?.querySelector('.oc-entity-filter-fields');
    if (!input || !label || !filters || !fields || label.dataset.fullAlbumSearch === '1') return;

    label.dataset.fullAlbumSearch = '1';
    label.classList.add('oc-entity-track-search-main');
    input.placeholder = 'Введите название OP/ED, исполнителя, режиссёра, студию или франшизу…';
    input.autocomplete = 'off';
    fields.before(label);

    if (!document.querySelector('#oc-entity-track-search-style')) {
      const style = document.createElement('style');
      style.id = 'oc-entity-track-search-style';
      style.textContent = `
        #oc-entity-filters .oc-entity-track-search-main {
          display: flex;
          width: 100%;
          margin: 0 0 16px;
        }
        #oc-entity-filters .oc-entity-track-search-main > span {
          font-size: 11px;
          color: #b4aabd;
        }
        #oc-entity-filters .oc-entity-track-search-main input {
          width: 100%;
          height: 58px;
          padding: 0 18px;
          border-color: #554268;
          border-radius: 15px;
          background: rgba(10, 8, 15, .94);
          font-size: 15px;
          box-shadow: inset 0 1px rgba(255, 255, 255, .025);
        }
        #oc-entity-filters .oc-entity-track-search-main input:focus {
          border-color: #a06ee8;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, .17);
        }
        #oc-entity-filters:not(.is-expanded) .oc-entity-track-search-main {
          display: flex;
          margin-top: 16px;
        }
        @media (max-width: 620px) {
          #oc-entity-filters .oc-entity-track-search-main input {
            height: 54px;
            padding: 0 14px;
            font-size: 14px;
          }
        }
      `;
      document.head.append(style);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAlbumTrackSearch, { once: true });
  } else {
    installAlbumTrackSearch();
  }
})();
