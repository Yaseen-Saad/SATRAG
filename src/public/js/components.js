document.addEventListener("alpine:init", () => {
    Alpine.store('theme', {
        dark: true, init() {
            const saved = localStorage.getItem('theme');
            if (saved) {
                this.dark = saved === 'dark';
            } else {
                this.dark = !window.matchMedia('(prefers-color-scheme: light)').matches;
            }
            this.apply();
        },
        toggle() {
            this.dark = !this.dark
            localStorage.setItem('theme', this.dark ? "dark" : "light")
            this.apply()
        },
        apply() {
            document.documentElement.setAttribute('data-theme', this.dark ? 'dark' : 'light');
            const meta = document.getElementById('theme-color-meta');
            if (meta) meta.content = this.dark ? '#090D16' : '#F8FAFC';
        }
    })

    Alpine.data('mobileNav', () => ({
        open: false, toggle() {
            this.open = !this.open
            document.getElementById('overlay')?.classList.toggle('visible', this.open)
        },
        close() {
            this.open = false;
            document.getElementById('overlay')?.classList.remove('visible')
        }
    }))

    Alpine.data('loadingForm', () => ({
        loading: false,
        submit() {
            this.loading = true;
        }
    }));

    Alpine.data('globalLoader', () => ({
        loading: false,
        init() {
            window.showLoader = () => { this.loading = true }
            window.hideLoader = () => { this.loading = false }
        }
    }))
})