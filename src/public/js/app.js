const flashes = 4000;
document.addEventListener('DOMContentLoaded', function () {
    const body = document.body;
    const html = document.documentElement
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const overlay = document.getElementById('overlay');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            navLinks.classList.toggle('show');
            if (overlay) {
                overlay.classList.toggle('show');
            }
        });
    }
    if (overlay) {
        overlay.addEventListener('click', function () {
            navLinks.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem("theme") || "dark"
    html.setAttribute("data-theme", savedTheme);
    if (themeToggle) {
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

    document.querySelectorAll('.rating-group').forEach(group => {
        group.addEventListener('click', e => {
            const button = e.target.closest('button.rating-btn');
            if (!button) return;
            group.querySelectorAll('button.rating-btn').forEach(btn => {
                btn.classList.remove('active');
            })
            button.classList.add('active');
            const input = group.querySelector('input[name="rating"][type="hidden"]');
            if (input) input.value = button.dataset.value;

        })
    })

    const forms = document.querySelectorAll('form[data-loading]');
    forms.forEach(form => {
        form.addEventListener('submit', function () {
            const button = this.querySelector("button[type='submit']");
            if (button && !button.disabled) {
                button.classList.add('loading');
                button.disabled = true;
            }
        });
    });
    document.querySelectorAll('a[href^="$#"]').forEach(link => {
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