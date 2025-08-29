
(function () {
  function log(){ try{ console.log('[pos_qty_focus v3]', ...arguments);}catch{} }

  const CFG = {
    rowSelectors: ['.cart-item-wrapper'],
    rowClickTargetSelectors: [':scope', '.item-qty', '.qty', '.item-rate'],
    // 👇 your popup/panel container
    detailsSelectors: ['.item-details-container'],
    // 👇 qty input inside the panel
    detailsQtySelectors: [
      '.qty-control [data-fieldname="qty"] input',
      'input[data-fieldname="qty"]',
      '.frappe-control[data-fieldname="qty"] input',
      '.control-input input[data-fieldname="qty"]'
    ],
    clickDelayMs: 60,
    panelWaitMs: 2000,
    panelPollEveryMs: 60,
    clickCooldownMs: 600
  };

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

  function findNewestRow(root){
    for (const rs of CFG.rowSelectors){
      const rows = root.querySelectorAll(rs);
      if (rows.length){
        log('rowSelector hit:', rs, 'count=', rows.length);
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
      if (el && isVisible(el)) { log('details panel hit:', q); return el; }
    }
  }

  function findQtyInDetails(panel){
    for (const q of CFG.detailsQtySelectors){
      const el = panel.querySelector(q);
      if (el && isVisible(el)) { log('qty in details via:', q, el); return el; }
    }
    log('details panel missing qty input — check selectors');
  }

  function selectInput(el, why){
    if (!el) return log('selectInput: no element', why);
    try {
      el.focus({ preventScroll:false });
      el.select?.();
      log('focused & selected qty', why, {tag: el.tagName, type: el.type, df: el.dataset?.fieldname});
    } catch(e) {
      log('focus/select failed', why, e?.message);
    }
  }

  function clickRowToOpenDetails(row, why){
    const now = Date.now();
    if (now - lastClickAt < CFG.clickCooldownMs){
      log('skip click (cooldown)');
      return;
    }
    // If details already open, don't click again
    const open = findDetailsPanel();
    if (open){
      log('skip click; details panel already open');
      return;
    }
    const target = findRowClickTarget(row);
    try {
      target.click();
      lastClickAt = now;
      log('clicked row', why, target);
    } catch(e) {
      log('row click failed', e?.message);
    }
  }

  function openDetailsAndFocusQty(row, why){
    clickRowToOpenDetails(row, why);
    const start = Date.now();

    const tick = ()=>{
      const panel = findDetailsPanel();
      if (panel){
        const qty = findQtyInDetails(panel);
        if (qty){ selectInput(qty, 'details'); return; }
      }
      if (Date.now() - start < CFG.panelWaitMs){
        setTimeout(tick, CFG.panelPollEveryMs);
      } else {
        log('details panel/qty not found within timeout');
      }
    };
    setTimeout(tick, CFG.clickDelayMs);
  }

  function onAnyDOMChange(nodes){
    if (!isPOSPage()) return;
    for (const n of nodes){
      if (!(n instanceof HTMLElement)) continue;

      // If the added node is a row
      if (CFG.rowSelectors.some(sel => n.matches?.(sel))){
        openDetailsAndFocusQty(n, 'observer:node-is-row');
        return;
      }
      // Or contains a row
      const r = findNewestRow(n);
      if (r){
        openDetailsAndFocusQty(r, 'observer:row-inside-node');
        return;
      }
    }
  }

  function start(){
    log('MutationObserver on body');
    const obs = new MutationObserver(muts=>{
      let added = [];
      muts.forEach(m => { if (m.addedNodes?.length) added = added.concat([...m.addedNodes]); });
      if (added.length) log('mutation batch; addedNodes=', added.length);
      onAnyDOMChange(added);
    });
    obs.observe(document.body, { childList:true, subtree:true });

    // If rows already exist, open the last one once
    setTimeout(()=>{
      const r = findNewestRow(document);
      if (r) openDetailsAndFocusQty(r, 'first-pass');
      else log('first-pass: no rows yet');
    }, 500);
  }

  function init(){
    if (!isPOSPage()) { log('init: not on POS page; route=', routeHead()); return; }
    start();
  }

  if (frappe?.router?.on){
    frappe.router.on('change', ()=>{ log('route change'); setTimeout(init, 50); });
  }
  setTimeout(()=>{ log('first init'); init(); }, 200);
})();


