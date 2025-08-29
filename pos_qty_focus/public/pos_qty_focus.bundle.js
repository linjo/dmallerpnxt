
(function () {
  // =========================
  // POS Qty Focus (Popup Mode)
  // =========================
  function log(){ try{ console.log('[pos_qty_focus]', ...arguments);}catch{} }

  // ---- Config: tweak if needed after first run ----
  const CFG = {
    // How to find a newly added cart row:
    rowSelectors: [
      '.pos-bill-item',
      '.cart-item-row',
      '.cart-items .row',
      '.pos-bill .row',
      // Broad fallbacks (kept after specific ones):
      '[class*="pos"] [class*="item"]',
      '[class*="cart"] [class*="item"]'
    ],

    // Where to click to open the popup editor (within the row):
    rowClickTargetSelectors: [
      // Often clicking the row is enough:
      ':scope',
      // Or a specific clickable area:
      '.qty, .quantity, .flex, .d-flex'
    ],

    // How to detect the popup/dialog container:
    dialogSelectors: [
      // frappe.ui.Dialog modal markup:
      '.modal[aria-modal="true"]',
      '.modal.show',
      '.frappe-control[role="dialog"]',
      // Very broad fallback:
      '.modal, [role="dialog"], .dialog, .frappe-dialog'
    ],

    // How to find the qty input inside the dialog:
    dialogQtySelectors: [
      'input[data-fieldname="qty"]',
      '.frappe-control[data-fieldname="qty"] input',
      '.qty input',
      'input.qty',
      'input[type="number"]',
      // Fallback: any input that looks like qty by name/id/dfname:
      'input'
    ],

    // Timing/retry knobs
    clickDelayMs: 50,      // small delay after click to allow popup render
    dialogWaitMs: 1500,    // how long to poll for dialog after click
    dialogPollEveryMs: 60, // polling interval for the dialog
    pollMax: 40            // fallback poll tries for rows after load
  };

  // ---- Helpers ----
  function routeHead(){
    try {
      if (frappe?.get_route) return frappe.get_route()[0];
      if (frappe?.router?.current_route) return frappe.router.current_route[0];
    } catch(e){}
    return undefined;
  }
  function isPOSPage(){
    const head = routeHead();
    const ok = (head === 'point-of-sale' || head === 'pos' || head === 'Point of Sale');
    if (!ok) log('not POS page; route=', head);
    return ok;
  }
  function selectInput(el, why){
    if (!el) return log('selectInput: no element', why);
    try { el.focus({preventScroll:false}); el.select?.(); log('focused qty', why, {tag:el.tagName, type:el.type, df:el.dataset?.fieldname}); }
    catch(e){ log('focus/select failed', why, e?.message); }
  }
  function looksLikeQty(el){
    if (!el || el.tagName !== 'INPUT') return false;
    if (el.matches('input[data-fieldname="qty"], .qty input, input.qty, input[type="number"]')) return true;
    const s = (el.name || el.id || el.dataset?.fieldname || '').toLowerCase();
    return /qty|quantity/.test(s);
  }
  function findNewestRow(root){
    for (const rs of CFG.rowSelectors){
      const rows = root.querySelectorAll(rs);
      if (rows.length){
        log('rowSelector hit:', rs, 'count=', rows.length);
        return rows[rows.length-1];
      }
    }
    return null;
  }
  function findRowClickTarget(row){
    for (const q of CFG.rowClickTargetSelectors){
      if (q === ':scope') return row; // click the row itself
      const el = row.querySelector(q);
      if (el) return el;
      }
    return row; // fallback: click row itself
  }
  function findDialog(){
    for (const q of CFG.dialogSelectors){
      const el = document.querySelector(q);
      if (el) { log('dialogMatcher hit:', q); return el; }
    }
    return null;
  }
  function findDialogQty(dialog){
    // 1) try explicit selectors
    for (const q of CFG.dialogQtySelectors){
      const el = dialog.querySelector(q);
      if (el && looksLikeQty(el)) { log('dialog qty via:', q); return el; }
    }
    // 2) fallback: scan inputs
    const any = Array.from(dialog.querySelectorAll('input')).find(looksLikeQty);
    if (any){ log('dialog qty via fallback scan'); return any; }
    log('dialog has no recognizable qty input; need a precise selector');
    return null;
  }
  function clickRowOpenDialog(row, why){
    const target = findRowClickTarget(row);
    if (!target) { log('no click target inside row'); return; }
    try { target.click(); log('clicked row to open dialog', why, target); }
    catch(e){ log('row click failed', e?.message); }
  }
  function openDialogAndFocusQty(row, why){
    clickRowOpenDialog(row, why);
    // wait/poll for dialog to mount
    const start = Date.now();
    const tick = ()=>{
      const dlg = findDialog();
      if (dlg){
        const qty = findDialogQty(dlg);
        if (qty){ selectInput(qty, 'dialog'); return; }
        // dialog present but no input yet — try again quickly:
      }
      if (Date.now() - start < CFG.dialogWaitMs){
        setTimeout(tick, CFG.dialogPollEveryMs);
      } else {
        log('dialog not found or qty not inside dialog within timeout');
      }
    };
    setTimeout(tick, CFG.clickDelayMs);
  }

  // ---- Observer: watch the whole page for new rows ----
  function onAnyDOMChange(nodes){
    if (!isPOSPage()) return;
    for (const n of nodes){
      if (!(n instanceof HTMLElement)) continue;

      // If the added node is itself a row:
      if (CFG.rowSelectors.some(sel => n.matches?.(sel))){
        log('observer: node is a row');
        openDialogAndFocusQty(n, 'observer:node-is-row');
        return;
      }
      // Or contains a row inside:
      const maybeRow = findNewestRow(n);
      if (maybeRow){
        log('observer: found row inside added node');
        openDialogAndFocusQty(maybeRow, 'observer:row-inside-node');
        return;
      }
    }
  }

  function startGlobalObserver(){
    log('setting global MutationObserver on document.body');
    const obs = new MutationObserver(muts=>{
      let added = [];
      muts.forEach(m => { if (m.addedNodes?.length) added = added.concat([...m.addedNodes]); });
      if (added.length) log('mutation batch; addedNodes=', added.length);
      onAnyDOMChange(added);
    });
    obs.observe(document.body, { childList:true, subtree:true });

    // First pass: if rows already exist (POS already loaded), click the last one:
    setTimeout(()=>{
      const row = findNewestRow(document);
      if (row){
        log('first-pass: clicking newest row to open dialog');
        openDialogAndFocusQty(row, 'first-pass');
      } else {
        log('first-pass: no rows found yet');
      }
    }, 500);

    // Fallback poll for a short window after load:
    let tries = 0;
    const poll = setInterval(()=>{
      if (!isPOSPage()){ clearInterval(poll); log('poll stop: not POS'); return; }
      tries++;
      const row = findNewestRow(document);
      if (row){
        if (!document.querySelector(CFG.dialogSelectors.join(','))){
          log('poll: clicking row to open dialog (try', tries, ')');
          openDialogAndFocusQty(row, 'poll');
        }
      } else {
        log('poll: no rows yet (try', tries, ')');
      }
      if (tries > CFG.pollMax){ clearInterval(poll); log('poll end'); }
    }, 300);
  }

  // ---- Kickoff ----
  function init(){
    if (!isPOSPage()) { log('init: not on POS page; route=', routeHead()); return; }
    startGlobalObserver();
  }
  if (frappe?.router?.on){
    frappe.router.on('change', ()=>{ log('route change'); setTimeout(init, 50); });
  } else {
    log('frappe.router.on not available');
  }
  setTimeout(()=>{ log('first init'); init(); }, 200);
})();


