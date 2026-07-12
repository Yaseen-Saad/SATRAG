(function () {
    'use strict';
    let questionId = document.getElementById('question-data')?.dataset?.id;
    let startTime = Date.now();
    let answered = false;
    let selectedAnswer = null;
    const timer = document.getElementById('timer');
    let timerInterval = null;
    if (timer)
        timerInterval = setInterval(_ => {
            if (answered) return;
            const elapsed = Math.floor((Date.now() - startTime) / 1000)
            const m = String(Math.floor(elapsed / 60)).padStart(2, "0")
            const s = String(elapsed % 60).padStart(2, "0")
            timer.textContent = `${m}:${s}`
        }, 1000)
    document.querySelectorAll('.bb-option').forEach(opt => {
        opt.addEventListener('click', function (e) {
            if (answered) return
            selectOption(this.dataset.label)
        })
    })
    window.selectOption = function (label) {
        document.querySelectorAll('.bb-option').forEach(opt => opt.classList.remove("selected"))
        const selected = document.querySelector(`.bb-option[data-label="${label}"]`)
        if (selected) selected.classList.add('selected')
        selectedAnswer = label;
        const btn = document.getElementById('submit-btn');
        if (btn) btn.disabled = false;
    }
    window.submitAnswer = async function (label) {
        if (answered) return
        answered = true;
        const timeMs = Date.now() - startTime;
        try {
            const res = await fetch(`/practice/question/${questionId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: label || selectedAnswer, timeMs }) })
            const data = await res.json();
            if (!data.success) {
                showFeedback('error', data.error || 'Error submitting answer', null);
                return
            }
            document.querySelectorAll(".bb-option").forEach(opt => {
                if (opt.dataset.label === data.correctAnswer) opt.classList.add('correct')
                else if (opt.dataset.label === selectedAnswer && !data.isCorrect) opt.classList.add('incorrect')
            })

            if (data.isCorrect) {
                const dot = document.querySelector(".bb-dot[data-index].current")
                if (dot) dot.classList.add('answered')
            }
            showFeedback(data.isCorrect ? "correct" : "incorrect", null, data)
        } catch (err) {
            showFeedback('error', err.message || 'Error submitting answer', null);
        }
    }
    function showFeedback(type, errorMsg, data) {
        const overlay = document.getElementById('feedback-overlay')
        if (!overlay) return
        const content = overlay.querySelector('.bb-feedback')
        if (!content) return;
        if (type === "error") {
            content.innerHTML = `
        <h2 style="color:var(--bb-incorrect);">Error</h2>
        <p>${errorMsg || 'Something went wrong'}</p>
        <div class="bb-fb-actions">
          <button class="bb-fb-btn primary" onclick="window.location='/practice'">Back to Bank</button>
          <button class="bb-fb-btn ghost" onclick="tryAgain()">Try Again</button>
        </div>`;
            overlay.classList.add('open');
            return;
        }
        const pct = data && data.percentile;
        content.innerHTML = `
        <h2 style="${data.isCorrect ? 'color:var(--bb-correct)' : 'color:var(--bb-incorrect)'}">
          ${data.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
        </h2>
        ${!data.isCorrect ? `<p>Correct answer: <strong>${data.correctAnswer}</strong></p>` : `<p>You selected <strong>${selectedAnswer}</strong></p>`}
        <p>Time: ${Math.round((Date.now() - startTime) / 1000)}s${pct != null && pct !== undefined ? ' · Faster than ' + pct + '% of users' : ''}</p>
        ${data.attemptNumber ? '<p>Attempt #' + data.attemptNumber + '</p>' : ''}
        <div class="bb-fb-actions">
          ${data.isCorrect ? '<button class="bb-fb-btn primary" onclick="window.location=\'/practice\'">Back to Bank</button>' : '<button class="bb-fb-btn success" onclick="tryAgain()">Try Again</button>'}
          <button class="bb-fb-btn ghost" onclick="toggleMarkBtn()">★ Mark for Review</button>
        </div>`;
        overlay.classList.add('open');
    }
    window.tryAgain = function () {
        answered = false
        selectedAnswer = null
        const btn = document.getElementById('submit-btn');
        if (btn) btn.disabled = true;
        document.querySelectorAll('.bb-option').forEach(option => {
            option.classList.remove('selected', 'correct', 'incorrect')
        })
        document.getElementById('feedback-overlay').classList.remove('open')
        startTime = Date.now()
    }

    const origSubmit = window.submitAnswer;
    window.submitAnswer = function(label) {
        if (timerInterval) clearInterval(timerInterval);
        origSubmit(label);
    };
    window.toggleMarkBtn = async () => {
        await fetch(`/practice/question/${questionId}/mark`);
        const btn = document.getElementById('mark-btn');
        const isMarked = btn.classList.toggle('marked');
        btn.textContent = isMarked ? '★ Marked' : '☆ Mark for Review';
        document.getElementById('feedback-overlay')?.classList.remove('open');
    }
    document.querySelectorAll('.bb-eliminate-btn').forEach(button => {
        button.addEventListener('click', function (e) {
            e.stopPropagation()
            const option = this.closest('.bb-option')
            option.classList.toggle('eliminated')
            this.textContent = option.classList.contains('eliminated') ? '✕' : '−'
        })
    })
    window.openPalette = function () {
        document.getElementById("palette-overlay")?.classList.add('open')
    }
    window.closePalette = function () {
        document.getElementById("palette-overlay")?.classList.remove('open')
    }
    document.getElementById("palette-overlay")?.addEventListener('click', e => {
        if (e.target === document.getElementById("palette-overlay")) closePalette();
    })
    document.getElementById('feedback-overlay')?.addEventListener('click', () => document.getElementById('feedback-overlay')?.classList.remove('open'))

    document.addEventListener('keydown', function (e) {
        if (document.querySelector('.bb-palette-overlay.open') || document.querySelector('.bb-feedback-overlay.open')) return;
        const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        if (keyMap[e.key] && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            window.selectOption(keyMap[e.key]);
        }
        if (e.key === 'Enter' && selectedAnswer) {
            e.preventDefault();
            window.submitAnswer();
        }
    });
})()
