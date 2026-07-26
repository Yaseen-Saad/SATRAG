document.addEventListener("DOMContentLoaded", () => {
    const counters = document.querySelectorAll('.stat-number[data-count]')
    if (!counters.length) return;

    function animateCounter(counter) {
        const target = parseInt(counter.getAttribute('data-count'), 10);
        if (isNaN(target) || target <= 0) return;
        const duration = 1700;
        let start = performance.now();

        function step(now) {
            let progress = Math.min((now - start) / duration, 1);
            let eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.floor(eased * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(step)
            else counter.textContent = target.toLocaleString()
        }
        requestAnimationFrame(step)
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target)
                observer.unobserve(entry.target)
            }
        })
    }, { threshold: 0.3 })
    counters.forEach(count => observer.observe(count))
})