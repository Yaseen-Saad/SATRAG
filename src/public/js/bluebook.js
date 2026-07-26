(function () {
    'use strict';
    let questionData = document.getElementById('question-data')?.dataset;
    let questionId = questionData?.id;
    let restoredAttempts = []
    try { restoredAttempts = JSON.parse(questionData?.attempts || '[]') } catch (error) { console.error('Failed to parse attempts:', error) }
    let alreadyAnswered = questionData?.answered === 'true';
    let wasCorrect = questionData?.correct === 'true';
    let startTime = Date.now();
    let answered = false;
    let selectedAnswer = null;
    let timerInterval = null;
    if (alreadyAnswered && restoredAttempts.length) {
        answered = true
        if (timerInterval) clearInterval(timerInterval)
        const lastAttempt = restoredAttempts[restoredAttempts.length - 1]
        document.querySelectorAll('.bb-option').forEach(opt => {
            if (opt.dataset.label === lastAttempt.selected_answer) {
                opt.classList.add('selected')
                opt.classList.add(wasCorrect ? 'correct' : 'incorrect')
            }
            if (!wasCorrect && opt.dataset.label !== lastAttempt.selected_answer) {
                const correctLabel = questionData?.correctanswer
                if (correctLabel && opt.dataset.label === correctLabel) opt.classList.add('correct')
            }
        })
    }

    document.querySelectorAll('.bb-stem, .bb-passage-content').forEach(ele => {
        ele.querySelectorAll('.sr-only').forEach(span => span.remove())
    })

    const timer = document.getElementById('timer');

    if (timer) {
        if (!alreadyAnswered) {
            timerInterval = setInterval(_ => {
                if (answered) return;
                const elapsed = Math.floor((Date.now() - startTime) / 1000)
                const m = String(Math.floor(elapsed / 60)).padStart(2, "0")
                const s = String(elapsed % 60).padStart(2, "0")
                timer.textContent = `${m}:${s}`
            }, 1000)
        }
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
            if (answered) return;
            answered = true;
            const timeMs = Date.now() - startTime;
            if (timerInterval) clearInterval(timerInterval);
            try {
                const res = await fetch(`/practice/question/${questionId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: label || selectedAnswer, timeMs }) })
                const data = await res.json();
                if (!data.success) {
                    showFeedback('error', data.error || 'Error submitting answer', null);
                    return
                }
                document.querySelectorAll(".bb-option").forEach(opt => {
                    if (opt.dataset.label === selectedAnswer && !data.isCorrect) opt.classList.add('incorrect')
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
                const safeMsg = errorMsg ? errorMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : 'Something went wrong';
                content.innerHTML = `
        <h2 style="color:var(--bb-incorrect)">Error</h2>
        <p>${safeMsg}</p>
        <div class="bb-fb-actions">
          <button class="bb-fb-btn primary" onclick="window.location=document.getElementById('return-to')?.dataset?.url || '/practice'">Back to Bank</button>
          <button class="bb-fb-btn ghost" onclick="tryAgain()">Try Again</button>
        </div>`;
                overlay.classList.add('open');
                return;
            }
            const pct = data && data.percentile;
            const showMistakesBtn = !data.isCorrect && data.isWIC;
            content.innerHTML = `
        <h2 style="${data.isCorrect ? 'color:var(--bb-correct)' : 'color:var(--bb-incorrect)'}">
          ${data.isCorrect ? '<img src="/img/icon-check.svg" width="22" height="22"/> Correct!' : '<img src="/img/icon-x.svg" width="22" height="22"/> Incorrect'}
        </h2>
        ${!data.isCorrect ? `<button class="bb-fb-btn ghost" id="show-correct-btn" onclick="window.showCorrectAnswer('${String(data.correctAnswer).replace(/'/g, "\\'")}')">Show Correct Answer</button>` : `<p>You selected <strong>${String(selectedAnswer).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</strong></p>`}
        <p>Time: ${Math.round((Date.now() - startTime) / 1000)}s${pct != null && pct !== undefined ? ' · Faster than ' + pct + '% of users' : ''}</p>
        ${data.attemptNumber ? '<p>Attempt #' + data.attemptNumber + '</p>' : ''}
        ${showMistakesBtn ? '<div class="bb-mistakes-prompt"><p>This is a Words in Context question. Add the answer words to your <strong>Mistakes</strong> list?</p><button class="bb-fb-btn" id="add-mistakes-btn" onclick="addToMistakes()">+ Add to Mistakes</button> <span id="mistakes-status"></span></div>' : ''}
        ${data.explanation ? '<details class="bb-explanation"><summary>Show Explanation</summary><div>' + data.explanation + '</div></details>' : ''}
        <div class="bb-fb-actions">
          ${data.isCorrect ? '<button class="bb-fb-btn primary" onclick="window.location=document.getElementById(\'return-to\')?.dataset?.url || \'/practice\'">Back to Bank</button>' : '<button class="bb-fb-btn success" onclick="tryAgain()">Try Again</button>'}
          <button class="bb-fb-btn ghost" onclick="toggleMarkBtn()"><img src="/img/markForReview.svg" alt="" width="14" height="14"> Mark for Review</button>
        </div>`;

            const qFeedbackData = document.getElementById('question-feedback-data')
            if (qFeedbackData) {
                const fbQuestionId = qFeedbackData.dataset.questionId
                const fbTier = qFeedbackData.dataset.tier
                const fbScore = qFeedbackData.dataset.score
                const fbCount = qFeedbackData.dataset.count

                const tierBadge = `<span class="tier-badge tier-badge--${fbTier}"><img src="/img/tier-${fbTier}.svg" alt="" width="12" height="12"> ${fbTier.charAt(0).toUpperCase() + fbTier.slice(1)}</span>${parseInt(fbCount) >= 3 ? ` <span class="qf-tier-score">(${parseFloat(fbScore).toFixed(1)}/10)</span>` : ` <span class="qf-tier-score">(${fbCount}/3 reviews)</span>`}`;
                const fbHtml = `
    <div class="qf-section">
        <div class="qf-tier-row">Rate this question's quality ${tierBadge}</div>
        <div class="qf-thumbs">
            <button class="qf-btn qf-btn--up" onclick="window.submitQuestionFeedback(true)"><img src="/img/icon-thumb-up.svg" alt="" width="16" height="16"> Good</button>
            <button class="qf-btn qf-btn--down" onclick="window.submitQuestionFeedback(false)"><img src="/img/icon-thumb-down.svg" alt="" width="16" height="16"> Bad</button>
        </div>
        <div class="qf-detail" id="qf-detail" style="display:none;">
            <div class="qf-slider-row">
                <span class="qf-slider-label">Satisfaction</span>
                <input type="range" class="qf-slider" id="qf-slider" min="1" max="10" value="5" oninput="document.getElementById('qf-slider-val').textContent=this.value">
                <span class="qf-slider-val" id="qf-slider-val">5</span>
            </div>
            <textarea class="qf-comment" id="qf-comment" rows="2" placeholder="What could be improved?"></textarea>
            <button class="qf-submit-btn" onclick="window.submitQuestionFeedbackDetail()">Submit</button>
        </div>
        <p class="qf-status" id="qf-status"></p>
    </div>`;
                content.insertAdjacentHTML('beforeend', fbHtml)

                fetch(`/question-feedback/${fbQuestionId}`).then(r => r.json()).then(d => {
                    if (d.success && d.userFeedback) {
                        const statusEl = document.getElementById('qf-status')
                        const thumbsEl = content.querySelector('.qf-thumbs')
                        if (statusEl) statusEl.textContent = `You rated this ${d.userFeedback.satisfaction}/10 (${d.userFeedback.is_positive ? '👍' : '👎'})`
                        if (thumbsEl) thumbsEl.style.display = 'none'
                    }
                }).catch(() => { })

                window.submitQuestionFeedback = function (isPositive) {
                    window._qfIsPositive = isPositive;
                    const detail = document.getElementById('qf-detail');
                    if (detail) detail.style.display = 'block';
                    document.querySelectorAll('.qf-thumbs .qf-btn').forEach(b => b.classList.add('is-disabled'));
                    const activeBtn = isPositive ? document.querySelector('.qf-btn--up') : document.querySelector('.qf-btn--down');
                    if (activeBtn) activeBtn.classList.add('is-active');
                }

                window.submitQuestionFeedbackDetail = async function () {
                    const slider = document.getElementById('qf-slider')
                    const comment = document.getElementById('qf-comment')
                    const status = document.getElementById('qf-status')
                    const satisfaction = slider ? parseInt(slider.value) : 5
                    const commentText = comment ? comment.value.trim() : ''
                    const isPositive = window._qfIsPositive !== undefined ? window._qfIsPositive : satisfaction >= 6
                    if (status) status.textContent = 'Submitting...'
                    try {
                        const res = await fetch(`/question-feedback/${fbQuestionId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ satisfaction, isPositive, comment: commentText })
                        })
                        const result = await res.json()
                        if (result.success) {
                            const labels = { diamond: 'Diamond', platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze', trash: 'Trash', unranked: 'Unranked' }
                            if (status) status.textContent = `Thanks! This question is now ${labels[result.tier] || 'Unranked'} (${result.avgSatisfaction}/10, ${result.positiveRatio}% positive)`
                            const detail = document.getElementById('qf-detail')
                            if (detail) detail.style.display = 'none'
                        } else {
                            if (status) status.textContent = 'Error: ' + (result.error || 'Unknown error')
                        }
                    } catch (e) {
                        if (status) status.textContent = 'Network error — please try again'
                    }
                }
            }

            overlay.classList.add('open');
        }

        window.addToMistakes = async function () {
            const btn = document.getElementById('add-mistakes-btn')
            const status = document.getElementById('mistakes-status')
            if (!btn) return
            btn.disabled = true
            btn.innerHTML = '<span class="spinner"></span> Adding words...'
            status.textContent = "";
            try {
                const res = await fetch(`/practice/question/${questionId}/add-mistakes`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                const data = await res.json()
                if (data.success && data.wordsFound > 0) {
                    btn.textContent = `Added ${data.wordsFound} words`
                    btn.classList.add('success')
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
            document.getElementById('feedback-overlay')?.classList.remove('open')
            startTime = Date.now()
            if (timer && !timerInterval) {
                timerInterval = setInterval(_ => {
                    if (answered) return;
                    const elapsed = Math.floor((Date.now() - startTime) / 1000)
                    const m = String(Math.floor(elapsed / 60)).padStart(2, "0")
                    const s = String(elapsed % 60).padStart(2, "0")
                    timer.textContent = `${m}:${s}`
                }, 1000)
            }
        }

        window.showCorrectAnswer = function (correctLabel) {
            document.querySelectorAll('.bb-option').forEach(opt => {
                if (opt.dataset.label === correctLabel) opt.classList.add('correct')
            })
            const btn = document.getElementById('show-correct-btn')
            if (btn) {
                btn.textContent = 'Correct: ' + correctLabel
                btn.disabled = true
                btn.style.opacity = '0.5'
                btn.style.pointerEvents = 'none'
            }
        }

        const origSubmit = window.submitAnswer;
        window.submitAnswer = function (label) {
            if (timerInterval) clearInterval(timerInterval);
            origSubmit(label);
        };
        window.toggleMarkBtn = async () => {
            try {
                await fetch(`/practice/question/${questionId}/mark`, { method: 'POST' });
                const btn = document.getElementById('mark-btn');
                if (btn) {
                    const isMarked = btn.classList.toggle('marked');
                    btn.innerHTML = isMarked ? '<img src="/img/icon-star.svg" alt="" width="14" height="14"> Marked' : '<img src="/img/icon-star-outline.svg" alt="" width="14" height="14"> Mark for Review';
                }
                document.getElementById('feedback-overlay')?.classList.remove('open');
            } catch (e) {
                console.error('Failed to toggle mark:', e);
            }
        }
        document.querySelectorAll('.bb-eliminate-btn').forEach(button => {
            button.addEventListener('click', function (e) {
                e.stopPropagation()
                const option = this.closest('.bb-option')
                if (option) {
                    option.classList.toggle('eliminated')
                    this.innerHTML = option.classList.contains('eliminated') ? '<img src="/img/icon-x.svg" alt="" width="14" height="14">' : '<img src="/img/icon-minus.svg" alt="" width="14" height="14">'
                }
            })
        })
        window.openPalette = function () {
            const paletteGrid = document.querySelector('.bb-palette-grid');
            if (paletteGrid) {
                paletteGrid.innerHTML = '<div class="bb-palette-item current">1</div>';
            }
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
            if (document.querySelector('.bb-palette-overlay.open') || document.querySelector('#feedback-overlay.open')) return;
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
    }
})()
