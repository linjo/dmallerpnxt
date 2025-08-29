
(function () {
	'use strict';
	
	console.log('[pos_qty_focus] Script starting...');
	
	function dbg(msg) {
		console.log('[pos_qty_focus]', msg);
	}
	
	function isPOSPage() {
		try {
			if (frappe && frappe.get_route && frappe.get_route()[0] === "point-of-sale") return true;
			if (window.location.pathname.includes('point-of-sale')) return true;
			if (document.querySelector('.point-of-sale-app')) return true;
			if (document.querySelector('.items-container')) return true;
			return false;
		} catch (e) {
			dbg('isPOSPage error: ' + e);
			return false;
		}
	}
	
	function focusQtyInput() {
		try {
			const qtyInput = document.querySelector('.item-details-container input[data-fieldname="qty"]');
			if (qtyInput) {
				qtyInput.focus();
				qtyInput.select();
				dbg('Qty input focused!');
				return true;
			}
			return false;
		} catch (e) {
			dbg('focusQtyInput error: ' + e);
			return false;
		}
	}
	
	function setupItemClickWatcher() {
		try {
			const itemsContainer = document.querySelector('.items-container');
			if (!itemsContainer) {
				dbg('items-container not found');
				return;
			}
			
			dbg('Setting up item click listener');
			itemsContainer.addEventListener('click', function(ev) {
				try {
					const target = ev.target.closest('.item-wrapper');
					if (!target) return;
					
					dbg('Item clicked, waiting for qty input...');
					setTimeout(function() {
						if (focusQtyInput()) {
							dbg('Qty input focused after item click');
						} else {
							dbg('Qty input not found, will watch for it');
							watchForQtyInput();
						}
					}, 150);
				} catch (e) {
					dbg('Item click error: ' + e);
				}
			});
		} catch (e) {
			dbg('setupItemClickWatcher error: ' + e);
		}
	}
	
	function watchForQtyInput() {
		try {
			const formContainer = document.querySelector('.item-details-container .form-container');
			if (!formContainer) {
				dbg('form-container not found');
				return;
			}
			
			dbg('Setting up form-container observer');
			const observer = new MutationObserver(function(mutations) {
				for (const mutation of mutations) {
					if (mutation.type === 'childList') {
						if (focusQtyInput()) {
							dbg('Qty input found via mutation observer');
							break;
						}
					}
				}
			});
			
			observer.observe(formContainer, { childList: true, subtree: true });
		} catch (e) {
			dbg('watchForQtyInput error: ' + e);
		}
	}
	
	function init() {
		try {
			if (!isPOSPage()) {
				dbg('Not POS page, skipping init');
				return;
			}
			
			dbg('POS page detected, initializing...');
			setupItemClickWatcher();
			watchForQtyInput();
			
			// Add test button
			const testBtn = document.createElement('button');
			testBtn.textContent = 'Test Qty Focus';
			testBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:red;color:white;padding:5px;border:none;border-radius:3px;cursor:pointer;';
			testBtn.onclick = function() {
				dbg('Test button clicked');
				if (focusQtyInput()) {
					dbg('Test successful - qty input focused');
				} else {
					dbg('Test failed - no qty input found');
				}
			};
			document.body.appendChild(testBtn);
			dbg('Test button added');
			
		} catch (e) {
			dbg('Init error: ' + e);
		}
	}
	
	// Start execution
	try {
		dbg('Script loaded, starting execution...');
		
		// Run on page load
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', init);
		} else {
			init();
		}
		
		// Also run on route changes
		if (frappe && frappe.router && frappe.router.on) {
			frappe.router.on('change', function() {
				dbg('Route change detected');
				setTimeout(init, 100);
			});
		}
		
		// Fallback: run every few seconds
		setInterval(function() {
			if (isPOSPage()) {
				init();
			}
		}, 3000);
		
		dbg('Script execution completed');
	} catch (e) {
		dbg('Critical error: ' + e);
		console.error('[pos_qty_focus] Critical error:', e);
	}
})();


