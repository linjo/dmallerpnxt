
(function () {
	// ===== Debug helpers =====
	window.posQtyFocusDebug = true; // set false to silence logs
	function dbg(...args) {
		if (!window.posQtyFocusDebug) return;
		const ts = new Date().toISOString().split('T')[1].replace('Z', '');
		try { console.log(`[pos_qty_focus ${ts}]`, ...args); } catch {}
	}

	dbg('script loaded');

	// ===== Route checks =====
	function getRouteHead() {
		try {
			if (frappe?.get_route) return frappe.get_route()[0];
			if (frappe?.router?.current_route) return frappe.router.current_route[0];
		} catch {}
		return undefined;
	}
	function isPOSPage() {
		const head = getRouteHead();
		const ok = head === 'point-of-sale' || head === 'pos';
		if (!ok) dbg('isPOSPage=false; route head =', head);
		return ok;
	}

	// ===== Focusing helpers =====
	function selectInput(element, context='') {
		if (!element) { dbg('selectInput: element missing', { context }); return; }
		try {
			element.focus({ preventScroll: false });
			element.select && element.select();
			dbg('Focused & selected qty input', { context, tag: element.tagName, type: element.type, dfname: element.dataset?.fieldname });
		} catch (e) {
			dbg('Focus/select failed', { context, error: e?.message });
		}
	}

	// ===== DOM discovery =====
	function findQtyInputForRow(rowEl) {
		if (!rowEl) return null;
		// 1) ERPNext fieldname
		let el = rowEl.querySelector('input[data-fieldname="qty"]');
		if (el) { dbg('findQtyInputForRow: matched [data-fieldname="qty"]'); return el; }
		// 2) Common class patterns
		el = rowEl.querySelector('.qty input, input.qty');
		if (el) { dbg('findQtyInputForRow: matched .qty input / input.qty'); return el; }
		// 3) Numeric input
		el = rowEl.querySelector('input[type="number"]');
		if (el) { dbg('findQtyInputForRow: matched input[type="number"]'); return el; }
		// 4) Fallback: any text-like input that looks like qty
		el = Array.from(rowEl.querySelectorAll('input')).find(i => /qty|quantity/i.test(i.name || i.id || i.dataset?.fieldname || ''));
		if (el) { dbg('findQtyInputForRow: matched fallback by name/id'); return el; }

		dbg('findQtyInputForRow: no qty input found in row');
		return null;
	}

	function resolveCartContainer() {
		const queries = [
			'.pos-cart, .cart-container, .cart-items, .pos-bill, .item-cart',
			'#page-point-of-sale .pos-cart, #page-point-of-sale .cart-container, #page-point-of-sale .pos-bill',
		];
		for (const q of queries) {
			const el = document.querySelector(q);
			dbg('container query', q, '=>', !!el);
			if (el) return el;
		}
		return null;
	}

	// ===== Core logic =====
	function focusQtyOnAdd(cartContainer) {
		if (!cartContainer) { dbg('focusQtyOnAdd: no cartContainer'); return; }

		dbg('Setting up MutationObserver on cart container');

		const observer = new MutationObserver((mutations) => {
			if (!isPOSPage()) return;
			mutations.forEach((m, idx) => {
				if (m.addedNodes && m.addedNodes.length) {
					dbg('Mutation', idx, 'addedNodes:', m.addedNodes.length);
				}
				for (const node of m.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;

					// Try the node itself first, then search inside
					let rowEl = null;
					if (node.matches?.('.pos-bill-item, .cart-item-row, .cart-items .row')) {
						rowEl = node;
					} else {
						rowEl = node.querySelector?.('.pos-bill-item, .cart-item-row, .cart-items .row');
					}

					dbg('Checking added node for row', { matchedRow: !!rowEl, nodeTag: node.tagName, class: node.className });

					if (!rowEl) continue;
					const qtyInput = findQtyInputForRow(rowEl);
					if (qtyInput) {
						// Defer a tick so internal re-renders finish first
						setTimeout(() => selectInput(qtyInput, 'observer'), 0);
						return; // focus only the first relevant addition
					} else {
						dbg('Row found but qty input not found (observer path)');
					}
				}
			});
		});

		observer.observe(cartContainer, { childList: true, subtree: true });

		// Also focus last row on initial load/refresh
		const tryFocusLastRow = (why) => {
			if (!isPOSPage()) return;
			const rows = cartContainer.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row, .pos-bill .row');
			dbg('tryFocusLastRow:', why, 'rows=', rows.length);
			if (!rows.length) return;
			const last = rows[rows.length - 1];
			const qtyInput = findQtyInputForRow(last);
			if (qtyInput) setTimeout(() => selectInput(qtyInput, `tryFocusLastRow:${why}`), 0);
			else dbg('tryFocusLastRow: last row has no qty input');
		};

		// Run once after load
		setTimeout(() => tryFocusLastRow('post-setup'), 500);

		// Fallback: poll briefly in case observer misses events
		let tries = 0;
		const poll = setInterval(() => {
			if (!isPOSPage()) { clearInterval(poll); dbg('poll stopped: left POS page'); return; }
			tries += 1;
			const rows = document.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row, .pos-bill .row');
			if (rows.length) {
				const last = rows[rows.length - 1];
				const qtyInput = findQtyInputForRow(last);
				if (qtyInput && document.activeElement !== qtyInput) {
					dbg('poll focusing last row qty (try', tries, ')');
					selectInput(qtyInput, 'poll');
				}
			} else {
				dbg('poll: no rows yet (try', tries, ')');
			}
			if (tries > 40) { clearInterval(poll); dbg('poll: max tries reached'); }
		}, 300);
	}

	function initWhenPOSLoads() {
		if (!isPOSPage()) { dbg('init aborted: not on POS page'); return; }
		const container = resolveCartContainer();
		if (container) {
			dbg('Cart container found; initializing observer/pollers');
			focusQtyOnAdd(container);
		} else {
			dbg('No cart container found. Your POS DOM may differ; update selectors.');
		}
	}

	// Re-init on route changes
	if (frappe?.router?.on) {
		frappe.router.on('change', () => {
			dbg('Route change detected; scheduling init');
			setTimeout(initWhenPOSLoads, 50);
		});
	} else {
		dbg('frappe.router.on not available');
	}

	// First run
	setTimeout(() => {
		dbg('First-run init schedule fired');
		initWhenPOSLoads();
	}, 200);
})();


