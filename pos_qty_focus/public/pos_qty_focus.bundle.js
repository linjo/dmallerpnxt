
(function () {
	function dbg() {
		try {
			if (typeof console !== 'undefined' && console.log) {
				console.log.apply(console, ['[pos_qty_focus]'].concat(Array.from(arguments)));
			}
		} catch (e) {
			console.error('[pos_qty_focus] dbg error:', e);
		}
	}

	function isPOSPage() {
		try {
			// Check multiple ways to detect POS page
			if (frappe.get_route && frappe.get_route()[0] === "point-of-sale") return true;
			if (window.location.pathname.includes('point-of-sale')) return true;
			if (document.querySelector('.point-of-sale-app')) return true;
			if (document.querySelector('#page-point-of-sale')) return true;
			if (document.querySelector('.items-container')) return true;
			if (document.querySelector('.cart-container')) return true;
			if (document.querySelector('.customer-cart-container')) return true;
			return false;
		} catch (e) {
			dbg('isPOSPage error:', e);
			return false;
		}
	}

	function selectInput(element) {
		if (!element) return;
		try {
			dbg('selectInput called with:', element);
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
			dbg('selectInput error:', e);
		}
	}

	function watchForQtyInput() {
		// Watch for changes in the form-container where qty input appears
		const formContainer = document.querySelector('.item-details-container .form-container');
		if (!formContainer) {
			dbg('form-container not found, will retry');
			return;
		}

		dbg('setting up form-container observer on:', formContainer);
		const observer = new MutationObserver((mutations) => {
			dbg('form-container mutation detected:', mutations.length, 'changes');
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					dbg('childList mutation:', mutation.addedNodes.length, 'added,', mutation.removedNodes.length, 'removed');
					// Check if qty input was added
					const qtyInput = formContainer.querySelector('input[data-fieldname="qty"]');
					if (qtyInput) {
						dbg('qty input detected in form-container, focusing');
						setTimeout(() => selectInput(qtyInput), 100);
						break;
					} else {
						dbg('no qty input found in form-container after mutation');
						// Log what was added
						for (const node of mutation.addedNodes) {
							if (node instanceof HTMLElement) {
								dbg('added node:', node.tagName, node.className, node.innerHTML.substring(0, 100));
							}
						}
					}
				}
			}
		});

		observer.observe(formContainer, { childList: true, subtree: true });
		dbg('form-container observer active');
	}

	function setupItemClickWatcher() {
		const itemsContainer = document.querySelector('.items-container');
		if (!itemsContainer) {
			dbg('items-container not found');
			return;
		}

		dbg('setting up item click listener on:', itemsContainer);
		itemsContainer.addEventListener('click', (ev) => {
			try {
				dbg('click event on:', ev.target);
				const target = ev.target instanceof HTMLElement ? ev.target.closest('.item-wrapper') : null;
				if (!target) {
					dbg('no item-wrapper found, target was:', ev.target);
					return;
				}
				
				dbg('item clicked:', target);
				// Wait a bit for the form to populate, then check for qty input
				setTimeout(() => {
					dbg('checking for qty input after item click...');
					const qtyInput = document.querySelector('.item-details-container input[data-fieldname="qty"]');
					if (qtyInput) {
						dbg('qty input found after item click, focusing');
						selectInput(qtyInput);
					} else {
						dbg('qty input not found after item click, will watch for it');
						// Check what's in the form-container
						const formContainer = document.querySelector('.item-details-container .form-container');
						if (formContainer) {
							dbg('form-container contents:', formContainer.innerHTML.substring(0, 200));
						}
						watchForQtyInput();
					}
				}, 150);
			} catch (e) {
				dbg('item click error:', e);
			}
		}, { capture: true });
	}

	function initWhenPOSLoads() {
		try {
			if (!isPOSPage()) {
				dbg('not POS page, skipping init');
				return;
			}
			dbg('POS page detected, initializing');
			
			// Set up item click watcher
			setupItemClickWatcher();
			
			// Also watch for form-container changes
			watchForQtyInput();
			
		} catch (e) {
			dbg('initWhenPOSLoads error:', e);
		}
	}

	// Diagnostic marker so we can confirm asset is loaded
	if (typeof window !== 'undefined') {
		try {
			dbg('script loaded');
			// Add manual test button immediately
			const testBtn = document.createElement('button');
			testBtn.textContent = 'Test Qty Focus';
			testBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:red;color:white;padding:5px;border:none;border-radius:3px;cursor:pointer;';
			testBtn.onclick = function() {
				try {
					dbg('manual test clicked');
					dbg('current URL:', window.location.pathname);
					dbg('isPOSPage():', isPOSPage());
					
					// Check what elements exist
					dbg('point-of-sale-app:', !!document.querySelector('.point-of-sale-app'));
					dbg('items-container:', !!document.querySelector('.items-container'));
					dbg('form-container:', !!document.querySelector('.item-details-container .form-container'));
					
					// Try to find qty input
					const qty = document.querySelector('.item-details-container input[data-fieldname="qty"]');
					if (qty) {
						dbg('found qty input, focusing');
						selectInput(qty);
					} else {
						dbg('qty input not found - click an item first');
						dbg('available inputs:', document.querySelectorAll('input[data-fieldname="qty"]').length);
					}
				} catch (e) {
					dbg('test button error:', e);
				}
			};
			document.body.appendChild(testBtn);
			dbg('test button added');
		} catch (e) {
			dbg('button creation error:', e);
		}
	}

	try {
		if (frappe.router && frappe.router.on) {
			frappe.router.on('change', () => {
				// run on every route change
				dbg('route change');
				setTimeout(initWhenPOSLoads, 50);
			});
		} else {
			dbg('frappe.router not available');
		}
	} catch (e) {
		dbg('router setup error:', e);
	}

	// also run on first load
	setTimeout(initWhenPOSLoads, 200);
	// Also run every 2 seconds to catch late loading
	setInterval(() => {
		try {
			if (isPOSPage()) {
				initWhenPOSLoads();
			}
		} catch (e) {
			dbg('interval error:', e);
		}
	}, 2000);
})();


