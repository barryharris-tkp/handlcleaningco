/* =========================================
   H&L Cleaning Co. — Interactive Logic
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {

    // ---- State ----
    const state = {
        base: 80,
        baseLabel: 'Under 2,200 sq ft',
        rooms: 0,
        bathrooms: 0,
        deepclean: false,
        laundryWD: 0,
        laundryWDF: 0,
        windows: 0,
        fridge: false,
        oven: false,
        freq: 'weekly'
    };

    const prices = {
        rooms: 12,
        bathrooms: 20,
        deepclean: 25,
        laundryWD: 10,
        laundryWDF: 15,
        windows: 5,
        fridge: 25,
        oven: 25,
        onetimeFee: 50
    };

    // ---- DOM refs ----
    const totalEl = document.getElementById('totalAmount');
    const freqEl = document.getElementById('totalFreq');
    const breakdownEl = document.getElementById('breakdown');

    // Modal refs
    const modal = document.getElementById('consultModal');
    const modalSummary = document.getElementById('modalSummary');
    const modalTotal = document.getElementById('modalTotal');
    const modalFreq = document.getElementById('modalFreq');
    const modalPackageInput = document.getElementById('modalPackageInput');
    const contactPackageSummary = document.getElementById('contactPackageSummary');

    // ---- Navigation ----
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
    });

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('open');
        mobileMenu.classList.toggle('open');
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('open');
            mobileMenu.classList.remove('open');
        });
    });

    // ---- Base selection ----
    document.querySelectorAll('input[name="base"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'estimate') {
                state.base = 0;
                state.baseLabel = 'Over 3,000 sq ft';
            } else {
                state.base = parseInt(val);
                state.baseLabel = state.base === 80 ? 'Under 2,200 sq ft' : '2,200 – 3,000 sq ft';
            }
            updateTotal();
        });
    });

    // ---- Counter add-ons ----
    document.querySelectorAll('.addon-card:not(.addon-toggle)').forEach(card => {
        const addon = card.dataset.addon;
        const countEl = card.querySelector('.counter-val');

        card.querySelectorAll('.counter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'plus') {
                    state[addon]++;
                } else if (action === 'minus' && state[addon] > 0) {
                    state[addon]--;
                }
                countEl.textContent = state[addon];

                countEl.style.transform = 'scale(1.3)';
                setTimeout(() => { countEl.style.transition = '0.2s ease'; countEl.style.transform = 'scale(1)'; }, 100);

                card.classList.toggle('active', state[addon] > 0);
                updateTotal();
            });
        });
    });

    // ---- Toggle add-ons (deep clean, fridge, oven) ----
    const toggleAddons = [
        { id: 'deepclean-toggle', key: 'deepclean', card: '[data-addon="deepclean"]' },
        { id: 'fridge-toggle', key: 'fridge', card: '[data-addon="fridge"]' },
        { id: 'oven-toggle', key: 'oven', card: '[data-addon="oven"]' }
    ];

    toggleAddons.forEach(({ id, key, card }) => {
        const toggle = document.getElementById(id);
        const cardEl = document.querySelector(card);
        toggle.addEventListener('change', () => {
            state[key] = toggle.checked;
            cardEl.classList.toggle('active', state[key]);
            updateTotal();
        });
    });

    // ---- Frequency ----
    document.querySelectorAll('input[name="freq"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.freq = e.target.value;
            updateTotal();
        });
    });

    // ---- Calculate & render total ----
    function updateTotal() {
        const total = calcTotal();

        totalEl.textContent = state.base === 0 ? 'Custom' : `$${total}`;
        totalEl.classList.remove('bump');
        void totalEl.offsetWidth;
        totalEl.classList.add('bump');

        if (state.base === 0) {
            freqEl.textContent = 'contact for estimate';
        } else {
            freqEl.textContent = state.freq === 'weekly' ? 'per visit / weekly' : 'one-time visit';
        }

        renderBreakdown();
        updatePackageSummary(total);
    }

    function calcTotal() {
        let total = state.base;
        total += state.rooms * prices.rooms;
        total += state.bathrooms * prices.bathrooms;
        if (state.deepclean) total += prices.deepclean;
        total += state.laundryWD * prices.laundryWD;
        total += state.laundryWDF * prices.laundryWDF;
        total += state.windows * prices.windows;
        if (state.fridge) total += prices.fridge;
        if (state.oven) total += prices.oven;
        if (state.freq === 'onetime') total += prices.onetimeFee;
        return total;
    }

    function getBreakdownItems() {
        let items = [];

        if (state.base === 0) {
            items.push({ label: 'Base (> 3,000 sqft)', price: 'Estimate' });
        } else {
            const baseLabel = state.base === 80 ? 'Base (< 2,200 sqft)' : 'Base (2,200–3,000 sqft)';
            items.push({ label: baseLabel, price: `$${state.base}` });
        }

        if (state.rooms > 0) {
            items.push({ label: `${state.rooms} Extra Room${state.rooms > 1 ? 's' : ''}`, price: `$${state.rooms * prices.rooms}` });
        }
        if (state.bathrooms > 0) {
            items.push({ label: `${state.bathrooms} Bathroom${state.bathrooms > 1 ? 's' : ''}`, price: `$${state.bathrooms * prices.bathrooms}` });
        }
        if (state.deepclean) {
            items.push({ label: 'Deep Clean Rotation', price: `$${prices.deepclean}/wk` });
        }
        if (state.laundryWD > 0) {
            items.push({ label: `${state.laundryWD} Wash & Dry Load${state.laundryWD > 1 ? 's' : ''}`, price: `$${state.laundryWD * prices.laundryWD}` });
        }
        if (state.laundryWDF > 0) {
            items.push({ label: `${state.laundryWDF} Wash/Dry/Fold Load${state.laundryWDF > 1 ? 's' : ''}`, price: `$${state.laundryWDF * prices.laundryWDF}` });
        }
        if (state.windows > 0) {
            items.push({ label: `${state.windows} Interior Window${state.windows > 1 ? 's' : ''}`, price: `$${state.windows * prices.windows}` });
        }
        if (state.fridge) {
            items.push({ label: 'Inside Refrigerator', price: `$${prices.fridge}` });
        }
        if (state.oven) {
            items.push({ label: 'Inside Oven', price: `$${prices.oven}` });
        }
        if (state.freq === 'onetime') {
            items.push({ label: 'One-Time Visit Fee', price: `+$${prices.onetimeFee}` });
        }

        return items;
    }

    function renderBreakdown() {
        const items = getBreakdownItems();
        breakdownEl.innerHTML = items.map((item, i) =>
            `<span class="breakdown-item" style="animation-delay: ${i * 0.05}s">
                ${item.label} <span class="b-price">${item.price}</span>
            </span>`
        ).join('');
    }

    function updatePackageSummary(total) {
        const items = getBreakdownItems();
        const summary = items.map(i => `${i.label}: ${i.price}`).join(' | ');
        const freq = state.freq === 'weekly' ? 'Weekly' : 'One-Time';
        const totalStr = state.base === 0 ? 'Custom Estimate' : `$${total} per visit`;
        const full = `${summary} | Frequency: ${freq} | Estimated Total: ${totalStr}`;

        if (modalPackageInput) modalPackageInput.value = full;
        if (contactPackageSummary) contactPackageSummary.value = full;
    }

    // ---- Modal ----
    const openBtn = document.getElementById('openConsultation');
    const closeBtn = document.getElementById('closeModal');

    function openModal() {
        const total = calcTotal();
        const items = getBreakdownItems();

        // Render summary items
        modalSummary.innerHTML = items.map(item =>
            `<div class="modal-summary-item">
                <span class="msi-label">${item.label}</span>
                <span class="msi-price">${item.price}</span>
            </div>`
        ).join('');

        modalTotal.textContent = state.base === 0 ? 'Custom' : `$${total}`;
        modalFreq.textContent = state.freq === 'weekly' ? 'per visit / weekly' : 'one-time visit';

        updatePackageSummary(total);

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        // Reset to form state if success panel is showing
        if (formSuccess && formSuccess.classList.contains('active')) {
            resetModalToForm();
        }
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    // Also wire up nav "Book a Consultation" links to open modal
    document.querySelectorAll('a[href="#contact"]').forEach(link => {
        // Only the nav CTA and hero button should open modal if coming from builder context
        // Keep the contact section link as-is for general contact
    });

    // ---- Scroll reveal ----
    const revealEls = document.querySelectorAll('.builder-step, .rotation-card, .policy-item, .step-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });

    // ---- Smooth scroll for anchor links ----
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ---- Initial render ----
    renderBreakdown();

    // ---- AJAX form submission (no redirect) ----
    const formSuccess = document.getElementById('formSuccess');
    const successCloseBtn = document.getElementById('successCloseBtn');
    let autoCloseTimer = null;

    function showSuccessPanel() {
        const modalHeader = modal.querySelector('.modal-header');
        const modalSummaryEl = modal.querySelector('.modal-summary');
        const modalTotalLine = modal.querySelector('.modal-total-line');
        const modalForm = modal.querySelector('.modal-form');

        // Fade out form content
        modalHeader.classList.add('hiding');
        modalSummaryEl.classList.add('hiding');
        modalTotalLine.classList.add('hiding');
        modalForm.classList.add('hiding');

        setTimeout(() => {
            modalHeader.style.display = 'none';
            modalSummaryEl.style.display = 'none';
            modalTotalLine.style.display = 'none';
            modalForm.style.display = 'none';

            // Show success panel
            formSuccess.classList.add('active');

            // Auto-close after 4 seconds
            autoCloseTimer = setTimeout(() => {
                resetModalToForm();
                closeModal();
            }, 4000);
        }, 300);
    }

    function resetModalToForm() {
        if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
        }

        const modalHeader = modal.querySelector('.modal-header');
        const modalSummaryEl = modal.querySelector('.modal-summary');
        const modalTotalLine = modal.querySelector('.modal-total-line');
        const modalForm = modal.querySelector('.modal-form');

        // Hide success, restore form elements
        formSuccess.classList.remove('active');

        modalHeader.classList.remove('hiding');
        modalSummaryEl.classList.remove('hiding');
        modalTotalLine.classList.remove('hiding');
        modalForm.classList.remove('hiding');

        modalHeader.style.display = '';
        modalSummaryEl.style.display = '';
        modalTotalLine.style.display = '';
        modalForm.style.display = '';

        // Reset button state
        const btn = modalForm.querySelector('button[type="submit"]');
        btn.textContent = 'Send & Book Consultation';
        btn.style.opacity = '1';
        btn.disabled = false;
    }

    successCloseBtn.addEventListener('click', () => {
        resetModalToForm();
        closeModal();
    });

    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = 'Sending...';
            btn.style.opacity = '0.7';
            btn.disabled = true;

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    form.reset();
                    showSuccessPanel();
                } else {
                    btn.textContent = 'Error — Try Again';
                    btn.style.opacity = '1';
                    btn.disabled = false;
                }
            } catch {
                btn.textContent = 'Error — Try Again';
                btn.style.opacity = '1';
                btn.disabled = false;
            }
        });
    });
});
