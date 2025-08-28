
(function () {
	// Diagnostic marker so we can confirm asset is loaded
	if (typeof window !== 'undefined') {
		console && console.log && console.log('[pos_qty_focus] script loaded');
	}
	function isPOSPage() {
		return frappe.get_route && frappe.get_route()[0] === "point-of-sale";
	}

	function selectInput(element) {
		if (!element) return;
		try {
			element.focus({ preventScroll: false });
			element.select && element.select();
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
		// 2) .qty input inside the row
		el = rowEl.querySelector('.qty input, input.qty');
		if (el) return el;
		// 3) any numeric input that likely represents qty
		el = rowEl.querySelector('input[type="number"]');
		return el;
	}

	function focusQtyOnAdd(cartContainer) {
		if (!cartContainer) return;
		const observer = new MutationObserver((mutations) => {
			if (!isPOSPage()) return;
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;
					// new line item row commonly has classes like .pos-bill-item or .cart-item-row
					const rowEl =
						node.matches && (node.matches('.pos-bill-item, .cart-item-row, .cart-items .row') ? node : node.querySelector?.('.pos-bill-item, .cart-item-row, .cart-items .row'));
					if (!rowEl) continue;
					const qtyInput = findQtyInputForRow(rowEl);
					if (qtyInput) {
						// Defer a tick so any internal re-renders finish first
						setTimeout(() => selectInput(qtyInput), 0);
						break;
					}
				}
			}
		});

		observer.observe(cartContainer, { childList: true, subtree: true });

		// Also focus on first render of existing last row when POS loads or when cart refreshes
		const tryFocusLastRow = () => {
			if (!isPOSPage()) return;
			const rows = cartContainer.querySelectorAll('.pos-bill-item, .cart-item-row, .cart-items .row');
			if (rows.length === 0) return;
			const last = rows[rows.length - 1];
			const qtyInput = findQtyInputForRow(last);
			if (qtyInput) setTimeout(() => selectInput(qtyInput), 0);
		};

		// Run once after load
		setTimeout(tryFocusLastRow, 500);
	}

	function initWhenPOSLoads() {
		if (!isPOSPage()) return;
		// cart container candidates
		const candidates = [
			document.querySelector('.pos-cart, .cart-container, .cart-items, .pos-bill, .item-cart'),
			document.querySelector('#page-point-of-sale .pos-cart, #page-point-of-sale .cart-container, #page-point-of-sale .pos-bill'),
		];
		const container = candidates.find(Boolean);
		if (container) {
			focusQtyOnAdd(container);
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
			if (tries > 40) clearInterval(poll); // ~12s max
		}, 300);
	}

	frappe.router && frappe.router.on && frappe.router.on('change', () => {
		// run on every route change
		setTimeout(initWhenPOSLoads, 50);
	});

	// also run on first load
	setTimeout(initWhenPOSLoads, 200);
})();


