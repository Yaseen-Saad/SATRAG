document.addEventListener("alpine:init", () => {
    Alpine.store('theme', {
        dark: true, init() {
            const saved = localStorage.getItem('theme')
            if (saved) {
                this.dark = saved == "dark"
            }
            else {
                this.dark = true
            }
            this.apply()
        },
        toggle() {
            this.dark = !this.dark
            localStorage.setItem('theme', this.dark ? "dark" : "light")
            this.apply()
        },
        apply() {
            document.documentElement.setAttribute('data-theme', this.dark ? "dark" : "light")
        }
    })

    Alpine.data('mobileNav', () => ({
        open: false, toggle() {
            this.open = !this.open
            document.getElementById('overlay')?.classList.toggle('visible', this.open)
        },
        close() {
            this.open = false;
            document.getElementById('overlay').classList.remove('visible')
        }
    }))
    Alpine.data('loadingForm', () => ({
        loading: false,
        submit() {
            this.loading = true;
        }
    }));
})