
(function(){
  function log(){ try{ console.log('[pos_qty_focus]', ...arguments);}catch{}}

  log('loaded');

  function routeHead(){
    try {
      if (frappe?.get_route) return frappe.get_route()[0];
      if (frappe?.router?.current_route) return frappe.router.current_route[0];
    } catch(e){}
    return undefined;
  }
  function isPOSPage(){
    const head = routeHead();
    const ok = (head === 'point-of-sale' || head === 'pos');
    if (!ok) log('not POS page; route=', head);
    return ok;
  }

  function selectInput(el, why){
    if (!el) return log('selectInput: no element', why);
    try { el.focus({preventScroll:false}); el.select?.(); log('focused qty', why, el); }
    catch(e){ log('focus/select failed', why, e?.message); }
  }

  function findQtyInputForRow(row){
    if (!row) return null;
    let el = row.querySelector('input[data-fieldname="qty"]'); if (el) { log('qty by [data-fieldname=qty]'); return el; }
    el = row.querySelector('.qty input, input.qty');          if (el) { log('qty by .qty input'); return el; }
    el = row.querySelector('input[type="number"]');           if (el) { log('qty by [type=number]'); return el; }
    el = Array.from(row.querySelectorAll('input')).find(i => /qty|quantity/i.test(i.name||i.id||i.dataset?.fieldname||'')); 
    if (el) { log('qty by fallback'); return el; }
    log('no qty input in row'); return null;
  }

  function resolveContainer(){
    const qs = [
      '.pos-cart, .cart-container, .cart-items, .pos-bill, .item-cart',
      '#page-point-of-sale .pos-cart, #page-point-of-sale .cart-container, #page-point-of-sale .pos-bill'
    ];
    for (const q of qs){
      const el = document.querySelector(q);
      log('container query', q, '=>', !!el);
      if (el) return el;
    }
    return null;
  }

  function start(cart){
    if (!cart) return log('no cart container; aborting');

    log('setting MutationObserver');
    const obs = new MutationObserver(muts=>{
      if (!isPOSPage()) return;
      muts.forEach((m,i)=>{
        if (m.addedNodes?.length) log('mutation', i, 'addedNodes=', m.addedNodes.length);
        for (const n of m.addedNodes){
          if (!(n instanceof HTMLElement)) continue;
          const row = n.matches?.('.pos-bill-item, .cart-item-row, .cart-items .row')
                   ? n
                   : n.querySelector?.('.pos-bill-item, .cart-item-row, .cart-items .row');
          log('added node checked; matchedRow=', !!row, 'tag=', n.tagName, 'class=', n.className);
          if (!row) continue;
          const qty = findQtyInputForRow(row);
          if (qty){ setTimeout(()=>selectInput(qty, 'observer'), 0); return; }
        }
      });
    });
    obs.observe(cart, { childList:true, subtree:true });

    const focusLast = (why)=>{
      if (!isPOSPage()) return;
      const rows = cart.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row, .pos-bill .row');
      log('focusLast', why, 'rows=', rows.length);
      if (!rows.length) return;
      const last = rows[rows.length-1];
      const qty = findQtyInputForRow(last);
      if (qty) setTimeout(()=>selectInput(qty, 'focusLast:'+why), 0);
    };

    setTimeout(()=>focusLast('post-setup'), 500);

    let tries=0;
    const poll = setInterval(()=>{
      if (!isPOSPage()){ clearInterval(poll); log('poll stop: not POS'); return; }
      tries++;
      const rows = document.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row, .pos-bill .row');
      if (rows.length){
        const last = rows[rows.length-1];
        const qty = findQtyInputForRow(last);
        if (qty && document.activeElement !== qty){
          log('poll focusing try', tries);
          selectInput(qty, 'poll');
        }
      } else {
        log('poll: no rows try', tries);
      }
      if (tries > 40){ clearInterval(poll); log('poll end'); }
    }, 300);
  }

  function init(){
    if (!isPOSPage()) return log('init: not on POS page; route=', routeHead());
    const c = resolveContainer();
    if (!c) return log('init: container not found');
    log('init: container found; starting');
    start(c);
  }

  if (frappe?.router?.on){
    frappe.router.on('change', ()=>{ log('route change'); setTimeout(init, 50); });
  } else {
    log('frappe.router.on not available');
  }
  setTimeout(()=>{ log('first init'); init(); }, 200);
})();


