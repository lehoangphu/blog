// Shared header behavior for every page:
//   1. Shrink/solidify the sticky header on scroll.
//   2. Toggle the collapsible (mobile) menu from the hamburger button.
//   3. Smooth-scroll the home-page hero buttons to their in-page sections.
(function () {
    var header = document.getElementById('site-header');

    if (header) {
        var onScroll = function () {
            header.classList.toggle('is-scrolled', window.scrollY > 10);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // Collapsible menu toggle.
    var toggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (toggle && menu) {
        var setOpen = function (open) {
            menu.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            setOpen(!menu.classList.contains('open'));
        });
        // Close when clicking outside the menu or pressing Escape.
        document.addEventListener('click', function (e) {
            if (menu.classList.contains('open') &&
                !menu.contains(e.target) && !toggle.contains(e.target)) {
                setOpen(false);
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setOpen(false);
        });
    }

    // Eased smooth scroll for in-page anchors (home page hero buttons).
    function scrollToId(id) {
        var target = document.getElementById(id);
        if (!target) return;
        var offset = header ? header.offsetHeight : 0;
        var startY = window.scrollY;
        var endY = target.getBoundingClientRect().top + window.scrollY - offset;
        var distance = endY - startY;
        if (Math.abs(distance) < 1) return;

        var prefersReduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            window.scrollTo(0, endY);
            return;
        }

        var duration = Math.min(1200, Math.max(500, Math.abs(distance) * 0.6));
        var startTime = null;

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step(now) {
            if (startTime === null) startTime = now;
            var elapsed = now - startTime;
            var progress = Math.min(elapsed / duration, 1);
            window.scrollTo(0, startY + distance * easeInOutCubic(progress));
            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    var heroMap = {
        'discover our story': 'about',
        'book us now': 'hire'
    };
    var hero = document.getElementById('top');
    if (hero) {
        hero.querySelectorAll('a, button').forEach(function (el) {
            var id = heroMap[(el.textContent || '').trim().toLowerCase()];
            if (!id) return;
            el.addEventListener('click', function (e) {
                e.preventDefault();
                scrollToId(id);
            });
        });
    }
})();
