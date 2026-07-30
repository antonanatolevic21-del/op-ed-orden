(() => {
  const params = new URLSearchParams(window.location.search);
  const workspace = params.get('adminWorkspace') === '1'
    && window.parent !== window
    && window.frameElement?.id === 'oc-admin-workspace';
  window.OC_CATALOG_ADMIN_WORKSPACE = workspace;
  document.documentElement.classList.toggle('oc-catalog-admin-workspace', workspace);
})();
