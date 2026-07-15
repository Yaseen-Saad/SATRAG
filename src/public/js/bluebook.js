(function () {
    'use strict';
    let questionData = document.getElementById('question-data')?.dataset;
    let questionId = questionData?.id;
    let restoredAttempts = []
    try { restoredAttempts = JSON.parse(questionData?.attempts || '[]') } catch (error) { console.log(error) }
    let alreadyAnswered = questionData?.answered === 'true';
    let wasCorrect = questionData?.correct === 'true';
    let startTime = Date.now();
    let answered = false;
    let selectedAnswer = null;
    if (alreadyAnswered && restoredAttempts.length) {
        answered = true
        const lastAttempt = restoredAttempts[restoredAttempts.length - 1]
        document.querySelectorAll('.bb-option').forEach(opt => {
            if (opt.dataset.label === lastAttempt.selected_answer) opt.classList.add('selected')
            if (opt.dataset.label === lastAttempt.selected_answer) opt.classList.add(wasCorrect ? 'correct' : 'incorrect')
        })
    }
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
          <button class="bb-fb-btn primary" onclick="window.location=document.getElementById('return-to')?.dataset?.url || '/practice'">Back to Bank</button>
          <button class="bb-fb-btn ghost" onclick="tryAgain()">Try Again</button>
        </div>`;
            overlay.classList.add('open');
            return;
        }
        const pct = data && data.percentile;
        console.log(data);

        const showMistakesBtn = !data.isCorrect && data.isWIC;
        content.innerHTML = `
        <h2 style="${data.isCorrect ? 'color:var(--bb-correct)' : 'color:var(--bb-incorrect)'}">
          ${data.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
        </h2>
        ${!data.isCorrect ? `<p>Correct answer: <strong>${data.correctAnswer}</strong></p>` : `<p>You selected <strong>${selectedAnswer}</strong></p>`}
        <p>Time: ${Math.round((Date.now() - startTime) / 1000)}s${pct != null && pct !== undefined ? ' · Faster than ' + pct + '% of users' : ''}</p>
        ${data.attemptNumber ? '<p>Attempt #' + data.attemptNumber + '</p>' : ''}
        ${showMistakesBtn ? '<div id="mistakes-prompt" style="margin:1rem 0;padding:0.75rem;border:1px solid var(--border);border-radius:8px;"><p style="margin:0 0 0.5rem;">This is a Words in Context question. Add the answer words to your <strong>Mistakes</strong> list?</p><button class="bb-fb-btn" id="add-mistakes-btn" onclick="addToMistakes()" style="margin-right:0.5rem;">+ Add to Mistakes</button><span id="mistakes-status" style="font-size:0.85rem;color:var(--text-muted);"></span></div>' : ''}
        <div class="bb-fb-actions">
          ${data.isCorrect ? '<button class="bb-fb-btn primary" onclick="window.location=document.getElementById(\'return-to\')?.dataset?.url || \'/practice\'">Back to Bank</button>' : '<button class="bb-fb-btn success" onclick="tryAgain()">Try Again</button>'}
          <button class="bb-fb-btn ghost" onclick="toggleMarkBtn()">★ Mark for Review</button>
        </div>`;
        overlay.classList.add('open');
    }

    window.addToMistakes = async function () {
        const btn = document.getElementById('add-mistakes-btn')
        const status = document.getElementById('mistakes-status')
        if (!btn) return
        btn.disabled = true
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:0.4rem;"></span> Adding words...'
        status.textContent = "";
        try {
            console.log("Called!")
            const res = await fetch(`/practice/question/${questionId}/add-mistakes`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            const data = await res.json()
            if (data.success && data.wordsFound > 0) {
                btn.textContent = `Added ${data.wordsFound} words`
                btn.style.backgroundColor = `var(--bb-correct)`
                status.textContent = ""
            } else if (data.success && data.wordsFound === 0) {
                btn.textContent = `Words already in list`
                status.textContent = ""
            } else {

                btn.textContent = `Error, please try again`
                btn.disabled = false
                status.textContent = data.error || "Failed to add words"
            }
        } catch (error) {
            btn.textContent = `Error, please try again`
            btn.disabled = false
            status.textContent = "Network error — please try again"
        }
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
    window.submitAnswer = function (label) {
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
    document.getElementById('feedback-overlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('feedback-overlay')) document.getElementById('feedback-overlay')?.classList.remove('open')
    })

    document.addEventListener('keydown', function (e) {
        if (!document.getElementById('question-data')) return;
        if (document.querySelector('.bb-palette-overlay.open') || document.querySelector('.bb-feedback-overlay.open')) return;
        const isSpr = !!document.querySelector('.bb-spr-input')
        if (!isSpr) {
            const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
            if (keyMap[e.key] && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                window.selectOption(keyMap[e.key]);
            }
            if (e.key === 'Enter' && selectedAnswer) {
                e.preventDefault();
                window.submitAnswer();
            }
        } else {
            if (e.key === 'Enter') {
                e.preventDefault();
                const sprInput = document.getElementById('spr-answer');
                if (sprInput && sprInput.value.trim()) window.submitAnswer(sprInput.value.trim());
            }
        }
    });
})()
