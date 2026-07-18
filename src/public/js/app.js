document.addEventListener('DOMContentLoaded', function () {
    const body = document.body;
    const html = document.documentElement
    const hamburger = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');
    const overlay = document.getElementById('overlay');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            navLinks.classList.toggle('open');
            if (overlay) {
                overlay.classList.toggle('visible');
            }
        });
    }
    if (overlay) {
        overlay.addEventListener('click', function () {
            if (navLinks) navLinks.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem("theme") || window.matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
    html.setAttribute("data-theme", savedTheme);
    if (themeToggle) {
        themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
        themeToggle.addEventListener('click', function () {
            const currentTheme = html.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            html.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
        });
    }

    document.querySelectorAll('.flash').forEach(flash => {
        setTimeout(() => {
            flash.style.cssText = 'opacity: 0; transition: opacity 0.5s ease-out;';
            setTimeout(() => {
                flash.remove();
            }, 500);
        }, 4000);
    });

    document.querySelectorAll('.flash .dismiss').forEach(closeBtn => {
        closeBtn.addEventListener('click', function () {
            const flash = this.parentElement;
            flash.style.cssText = 'opacity: 0; transition: opacity 0.5s ease-out;';
            setTimeout(() => {
                flash.remove();
            }, 500);
        });
    })
    window.togglePassword = function (btn) {
        const input = btn.parentElement.querySelector('input[type="password"], input[type="text"]');
        if (!input) return
        const isPassword = input.type === 'password'
        input.type = isPassword ? 'text' : 'password'
        btn.textContent = isPassword ? 'Hide' : 'Show';
    }

    document.querySelectorAll('.rating-group').forEach(group => {
        group.addEventListener('click', e => {
            const button = e.target.closest('button.rating-btn');
            if (!button) return;
            group.querySelectorAll('button.rating-btn').forEach(btn => {
                btn.classList.remove('selected');
            })
            button.classList.add('selected');
            const input = group.querySelector('input[name="rating"][type="hidden"]');
            if (input) input.value = button.dataset.value;

        })
    })

    const forms = document.querySelectorAll('form[data-loading]');
    forms.forEach(form => {
        form.addEventListener('submit', function () {
            const button = this.querySelector("button[type='submit']");
            if (button && !button.disabled) {
                button.classList.add('is-loading');
                button.disabled = true;
            }
        });
    });
    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (window.location.pathname === '/flashcards/session') return;
        if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            const toggle = document.getElementById('theme-toggle');
            if (toggle) toggle.click();
            return;
        }
        const navLink = document.querySelector(`.nav-link[data-key="${e.key}"]`);
        if (navLink) { e.preventDefault(); navLink.click(); }
    });

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
})