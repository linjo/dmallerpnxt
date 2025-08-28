
(function () {
	function dbg() {
		try {
			if (typeof console !== 'undefined' && console.log) {
				console.log.apply(console, ['[pos_qty_focus]'].concat(Array.from(arguments)));
			}
		} catch (e) {}
	}

	function isPOSPage() {
		// Check multiple ways to detect POS page
		if (frappe.get_route && frappe.get_route()[0] === "point-of-sale") return true;
		if (window.location.pathname.includes('point-of-sale')) return true;
		if (document.querySelector('.point-of-sale-app')) return true;
		if (document.querySelector('#page-point-of-sale')) return true;
		if (document.querySelector('.items-container')) return true;
		if (document.querySelector('.cart-container')) return true;
		if (document.querySelector('.customer-cart-container')) return true;
		return false;
	}

	// Diagnostic marker so we can confirm asset is loaded
	if (typeof window !== 'undefined') {
		dbg('script loaded');
		// Add manual test button
		setTimeout(() => {
			const testBtn = document.createElement('button');
			testBtn.textContent = 'Test Qty Focus';
			testBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:red;color:white;padding:5px;border:none;border-radius:3px;';
			testBtn.onclick = () => {
				dbg('manual test clicked');
				dbg('current URL:', window.location.pathname);
				dbg('isPOSPage():', isPOSPage());
				dbg('frappe.get_route():', frappe.get_route ? frappe.get_route() : 'undefined');
				
				// Check what elements exist
				dbg('point-of-sale-app:', !!document.querySelector('.point-of-sale-app'));
				dbg('#page-point-of-sale:', !!document.querySelector('#page-point-of-sale'));
				dbg('.items-container:', !!document.querySelector('.items-container'));
				dbg('.cart-container:', !!document.querySelector('.cart-container'));
				dbg('.customer-cart-container:', !!document.querySelector('.customer-cart-container'));
				
				// Try to find qty input
				const qty = document.querySelector('.item-details-container input[data-fieldname="qty"]');
				if (qty) {
					dbg('found qty input, focusing');
					selectInput(qty);
				} else {
					dbg('qty input not found');
					dbg('available inputs:', document.querySelectorAll('input[data-fieldname="qty"]').length);
					
					// Show all qty-related elements
					const allQtyInputs = document.querySelectorAll('input[data-fieldname="qty"]');
					dbg('all qty inputs:', allQtyInputs);
					
					// Check item-details-container
					const itemDetails = document.querySelector('.item-details-container');
					dbg('item-details-container:', itemDetails);
					if (itemDetails) {
						dbg('item-details HTML:', itemDetails.innerHTML.substring(0, 200));
					}
				}
			};
			document.body.appendChild(testBtn);
		}, 2000);
	}

	function selectInput(element) {
		if (!element) return;
		try {
			// handle input and contenteditable
			if (element.getAttribute && element.getAttribute('contenteditable') === 'true') {
				const range = document.createRange();
				range.selectNodeContents(element);
				const sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
				element.focus({ preventScroll: false });
			} else {
				element.focus({ preventScroll: false });
				element.select && element.select();
			}
			// help some UIs that open keypad on click
			element.dispatchEvent(new Event('focus', { bubbles: true }));
			element.dispatchEvent(new Event('click', { bubbles: true }));
			dbg('focused qty element', element);
		} catch (e) {
			// ignore
		}
	}

	function findQtyInputForRow(rowEl) {
		if (!rowEl) return null;
		// Common patterns in ERPNext v15 POS cart rows
		// 1) input[data-fieldname="qty"] within row
		let el = rowEl.querySelector('input[data-fieldname="qty"]');
		if (el) return el;
		// 2) contenteditable qty (some POS builds use contenteditable spans/divs)
		el = rowEl.querySelector('[data-fieldname="qty"][contenteditable="true"], [data-fieldname="qty"] [contenteditable="true"]');
		if (el) return el;
		// 3) .qty input inside the row
		el = rowEl.querySelector('.qty input, input.qty');
		if (el) return el;
		// 4) any numeric input that likely represents qty
		el = rowEl.querySelector('input[type="number"]');
		return el;
	}

	function focusQtyOnAdd(cartContainer) {
		if (!cartContainer) return;
		dbg('setting observer on cart');
		const observer = new MutationObserver((mutations) => {
			if (!isPOSPage()) return;
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;
					// new line item row commonly has classes like .pos-bill-item or .cart-item-row
					const rowEl =
						node.matches && (node.matches('.pos-bill-item, .cart-item-row, .cart-items .row') ? node : node.querySelector?.('.pos-bill-item, .cart-item-row, .cart-items .row'));
					if (!rowEl) continue;
					dbg('detected new cart row, try focus item-details qty');
					// In v15, editable qty is in the right-side item details panel, not the cart row.
					// So focus the qty field in item-details if present.
					const detailsQty = document.querySelector('.item-details-container input[data-fieldname="qty"]');
					if (detailsQty) {
						setTimeout(() => selectInput(detailsQty), 0);
						break;
					}
				}
			}
		});

		observer.observe(cartContainer, { childList: true, subtree: true });

		// Also focus on first render of existing last row when POS loads or when cart refreshes
		const tryFocusLastRow = () => {
			if (!isPOSPage()) return;
			// Prefer focusing the item-details qty if it exists
			const detailsQty = document.querySelector('.item-details-container input[data-fieldname="qty"]');
			if (detailsQty) { dbg('tryFocusLastRow focusing item-details qty'); setTimeout(() => selectInput(detailsQty), 0); return; }
			const rows = cartContainer.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row, .pos-bill .row');
			if (rows.length === 0) return;
			const last = rows[rows.length - 1];
			const qtyInput = findQtyInputForRow(last);
			if (qtyInput) setTimeout(() => selectInput(qtyInput), 0);
		};

		// Run once after load
		setTimeout(tryFocusLastRow, 500);
	}

	function initWhenPOSLoads() {
		if (!isPOSPage()) {
			dbg('not POS page, skipping init');
			return;
		}
		dbg('POS page detected, initializing');
		// cart container candidates
		const candidates = [
			document.querySelector('.pos-cart, .cart-container, .cart-items, .pos-bill, .item-cart'),
			document.querySelector('#page-point-of-sale .pos-cart, #page-point-of-sale .cart-container, #page-point-of-sale .pos-bill'),
		];
		const container = candidates.find(Boolean);
		if (container) {
			dbg('cart container found');
			focusQtyOnAdd(container);
		} else {
			dbg('no cart container found, candidates:', candidates);
		}

		// Fallback: small polling to focus last row qty if observer misses DOM events
		let tries = 0;
		const poll = setInterval(() => {
			if (!isPOSPage()) { clearInterval(poll); return; }
			tries += 1;
			const rows = document.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row, .pos-bill .row');
			if (rows.length) {
				const last = rows[rows.length - 1];
				const qtyInput = findQtyInputForRow(last);
				if (qtyInput && document.activeElement !== qtyInput) {
					selectInput(qtyInput);
				}
			}
			if (tries % 10 === 0) dbg('poll tick', tries);
			if (tries > 40) { dbg('stop poll'); clearInterval(poll); } // ~12s max
		}, 300);

		// Also hook item clicks to focus qty shortly after selection
		const itemsContainer = document.querySelector('.items-container');
		if (itemsContainer) {
			dbg('setting up item click listener');
			itemsContainer.addEventListener('click', (ev) => {
				const target = ev.target instanceof HTMLElement ? ev.target.closest('.item-wrapper') : null;
				if (!target) return;
				dbg('item clicked; attempt focus');
				setTimeout(() => {
					const detailsQty2 = document.querySelector('.item-details-container input[data-fieldname="qty"]');
					if (detailsQty2) selectInput(detailsQty2);
				}, 120);
			}, { capture: true });
		} else {
			dbg('items-container not found');
		}
	}

	frappe.router && frappe.router.on && frappe.router.on('change', () => {
		// run on every route change
		dbg('route change');
		setTimeout(initWhenPOSLoads, 50);
	});

	// also run on first load
	setTimeout(initWhenPOSLoads, 200);
	// Also run every 2 seconds to catch late loading
	setInterval(() => {
		if (isPOSPage()) {
			initWhenPOSLoads();
		}
	}, 2000);
})();


