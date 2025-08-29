
(function () {
  function log(){ try{ console.log('[pos_qty_focus v3.1]', ...arguments);}catch{} }

  const CFG = {
    rowSelectors: ['.cart-item-wrapper'],
    rowClickTargetSelectors: [':scope', '.item-qty', '.qty', '.item-rate'],
    detailsSelectors: ['.item-details-container'],
    detailsQtySelectors: [
      '.qty-control [data-fieldname="qty"] input',
      'input[data-fieldname="qty"]',
      '.frappe-control[data-fieldname="qty"] input',
      '.control-input input[data-fieldname="qty"]'
    ],
    clickDelayMs: 60,
    panelWaitMs: 2000,
    panelPollEveryMs: 60,
    clickCooldownMs: 500
  };

  let lastClickedRowName = null;
  let lastFocusedPanelEl = null;
  let lastClickAt = 0;

  function routeHead(){
    try {
      if (frappe?.get_route) return frappe.get_route()[0];
      if (frappe?.router?.current_route) return frappe.router.current_route[0];
    } catch(e){}
  }
  function isPOSPage(){
    const h = routeHead();
    const ok = (h==='point-of-sale'||h==='pos'||h==='Point of Sale');
    if (!ok) log('not POS page; route=', h);
    return ok;
  }
  function isVisible(el){
    const s = el && window.getComputedStyle(el);
    return !!(el && s && s.display!=='none' && s.visibility!=='hidden');
  }
  function blockingModalPresent(){
    // avoid focusing if a bootstrap modal is visible but aria-hidden (causes the a11y warning)
    const m = document.querySelector('.modal.fade[aria-hidden="true"][style*="display"]');
    return !!(m && isVisible(m));
  }

  function findNewestRow(root){
    for (const rs of CFG.rowSelectors){
      const rows = root.querySelectorAll(rs);
      if (rows.length){
        return rows[rows.length-1];
      }
    }
  }
  function findRowClickTarget(row){
    for (const q of CFG.rowClickTargetSelectors){
      if (q === ':scope') return row;
      const el = row.querySelector(q);
      if (el) return el;
    }
    return row;
  }
  function findDetailsPanel(){
    for (const q of CFG.detailsSelectors){
      const el = document.querySelector(q);
      if (el && isVisible(el)) return el;
    }
  }
  function findQtyInDetails(panel){
    for (const q of CFG.detailsQtySelectors){
      const el = panel.querySelector(q);
      if (el && isVisible(el)) return el;
    }
  }

  function selectInput(el, why){
    if (!el) return;
    try { el.focus({ preventScroll:false }); el.select?.(); log('focused qty', why); }
    catch(e){ log('focus failed', why, e?.message); }
  }
  function wirePanelHotkeys(panel){
    if (panel.dataset.posQtyHotkeys) return; // once
    panel.dataset.posQtyHotkeys = '1';
    panel.addEventListener('keydown', (ev)=>{
      if (ev.key === 'Enter'){
        // commit: blur the qty (ERPNext will handle change)
        const qty = findQtyInDetails(panel);
        qty?.blur?.();
      } else if (ev.key === 'Escape'){
        // close the panel
        const close = panel.querySelector('.close-btn, [data-action="close"], button.btn-modal-close');
        if (close) close.click();
      }
    }, true);
  }

  function clickRowToOpenDetails(row, why){
    const now = Date.now();
    if (now - lastClickAt < CFG.clickCooldownMs) return;
    const rowName = row.getAttribute('data-row-name') || 'unknown';
    if (rowName && rowName === lastClickedRowName) return; // already handled this row

    const target = findRowClickTarget(row);
    try {
      target.click();
      lastClickAt = now;
      lastClickedRowName = rowName;
      log('clicked row', why, rowName);
    } catch(e) {
      log('row click failed', e?.message);
    }
  }

  function focusDetailsQtyOnce(panel){
    if (panel === lastFocusedPanelEl) return; // already focused this instance
    if (blockingModalPresent()){
      // try again a little later if a hidden modal is conflicting
      setTimeout(()=>focusDetailsQtyOnce(panel), 120);
      return;
    }
    const qty = findQtyInDetails(panel);
    if (qty){
      selectInput(qty, 'details');
      wirePanelHotkeys(panel);
      lastFocusedPanelEl = panel;
    }
  }

  function openDetailsAndFocusQty(row, why){
    clickRowToOpenDetails(row, why);
    const start = Date.now();
    const poll = ()=>{
      const panel = findDetailsPanel();
      if (panel){
        focusDetailsQtyOnce(panel);
        return;
      }
      if (Date.now() - start < CFG.panelWaitMs){
        setTimeout(poll, CFG.panelPollEveryMs);
      } else {
        log('details panel not found (timeout)');
      }
    };
    setTimeout(poll, CFG.clickDelayMs);
  }

  function onAnyDOMChange(nodes){
    if (!isPOSPage()) return;
    for (const n of nodes){
      if (!(n instanceof HTMLElement)) continue;

      // new or updated details panel appeared → focus once
      const det = n.matches?.('.item-details-container') ? n : n.querySelector?.('.item-details-container');
      if (det && isVisible(det)){
        focusDetailsQtyOnce(det);
        return;
      }

      // new cart row → click + then focus
      if (n.matches?.('.cart-item-wrapper') || n.querySelector?.('.cart-item-wrapper')){
        const r = n.matches?.('.cart-item-wrapper') ? n : n.querySelector('.cart-item-wrapper');
        openDetailsAndFocusQty(r, 'observer');
        return;
      }
    }
  }

  function start(){
    log('observer start');
    const obs = new MutationObserver(muts=>{
      let added = [];
      muts.forEach(m => { if (m.addedNodes?.length) added = added.concat([...m.addedNodes]); });
      if (added.length) onAnyDOMChange(added);
    });
    obs.observe(document.body, { childList:true, subtree:true });

    // first pass
    setTimeout(()=>{
      const r = findNewestRow(document);
      if (r) openDetailsAndFocusQty(r, 'first-pass');
    }, 400);
  }

  function init(){
    if (!isPOSPage()) { log('not POS'); return; }
    start();
  }

  if (frappe?.router?.on){
    frappe.router.on('change', ()=>{ log('route change'); setTimeout(init, 50); });
  }
  setTimeout(init, 200);
})();


