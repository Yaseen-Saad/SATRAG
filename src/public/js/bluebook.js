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
                const safeMsg = errorMsg ? errorMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : 'Something went wrong';
                content.innerHTML = `
        <h2 style="color:var(--bb-incorrect);">Error</h2>
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
          ${data.isCorrect ? '<img src="/img/icon-check.svg"/> Correct!' : '<img src="/img/icon-x.svg" /> Incorrect'}
        </h2>
        ${!data.isCorrect ? `<p>Correct answer: <strong>${String(data.correctAnswer).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</strong></p>` : `<p>You selected <strong>${String(selectedAnswer).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</strong></p>`}
        <p>Time: ${Math.round((Date.now() - startTime) / 1000)}s${pct != null && pct !== undefined ? ' · Faster than ' + pct + '% of users' : ''}</p>
        ${data.attemptNumber ? '<p>Attempt #' + data.attemptNumber + '</p>' : ''}
        ${showMistakesBtn ? '<div id="mistakes-prompt" style="margin:1rem 0;padding:0.75rem;border:1px solid var(--border);border-radius:8px;"><p style="margin:0 0 0.5rem;">This is a Words in Context question. Add the answer words to your <strong>Mistakes</strong> list?</p><button class="bb-fb-btn" id="add-mistakes-btn" onclick="addToMistakes()" style="margin-right:0.5rem;">+ Add to Mistakes</button><span id="mistakes-status" style="font-size:0.85rem;color:var(--text-muted);"></span></div>' : ''}
        <div class="bb-fb-actions">
          ${data.isCorrect ? '<button class="bb-fb-btn primary" onclick="window.location=document.getElementById(\'return-to\')?.dataset?.url || \'/practice\'">Back to Bank</button>' : '<button class="bb-fb-btn success" onclick="tryAgain()">Try Again</button>'}
          <button class="bb-fb-btn ghost" onclick="toggleMarkBtn()"><img src='/img/markForReview.svg' /> Mark for Review</button>
        </div>`;

            const qFeedbackData = document.getElementById('question-feedback-data')
            if (qFeedbackData) {
                const fbQuestionId = qFeedbackData.dataset.questionId
                const fbTier = qFeedbackData.dataset.tier
                const fbScore = qFeedbackData.dataset.score
                const fbCount = qFeedbackData.dataset.count

                const tierColors = { diamond: '#B9F2FF', platinum: '#E5E7EB', gold: '#FBBF24', silver: '#94A3B8', bronze: '#D97706', trash: '#EF4444', unranked: '#475569' }
                const tierLabels = { diamond: 'Diamond', platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze', trash: 'Trash', unranked: 'Unranked' }
                const tierIcon = { diamond: '💎', platinum: '⬡', gold: '★', silver: '●', bronze: '●', trash: '🗑', unranked: '○' }
                const tierBadge = `<span class="qf-tier-badge" style="background:${tierColors[fbTier] || tierColors.unranked};color:#0f172a;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:600;margin-left:0.5rem;">${tierIcon[fbTier] || tierIcon.unranked} ${tierLabels[fbTier] || 'Unranked'}${parseInt(fbCount) >= 3 ? ` (${parseFloat(fbScore).toFixed(1)}/10)` : ` (${fbCount}/${3} reviews)`}</span>`
                const fbHtml = `
            <div class="qf-section" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border,#334155);">
              <p style="margin:0 0 0.5rem;color:var(--text-muted,#94a3b8);font-size:0.85rem;">Rate this question's quality ${tierBadge}</p>
              <div class="qf-thumbs" style="display:flex;gap:0.75rem;margin-bottom:0.75rem;">
                <button class="qf-btn qf-up" onclick="window.submitQuestionFeedback(true)" style="padding:0.4rem 1.2rem;border:1px solid var(--border,#334155);border-radius:8px;background:transparent;color:var(--text,#e2e8f0);cursor:pointer;font-size:0.9rem;transition:all 0.15s;">👍 Good</button>
                <button class="qf-btn qf-down" onclick="window.submitQuestionFeedback(false)" style="padding:0.4rem 1.2rem;border:1px solid var(--border,#334155);border-radius:8px;background:transparent;color:var(--text,#e2e8f0);cursor:pointer;font-size:0.9rem;transition:all 0.15s;">👎 Bad</button>
              </div>
              <div id="qf-detail" style="display:none;">
                <label style="display:block;margin-bottom:0.35rem;color:var(--text-muted,#94a3b8);font-size:0.8rem;">Satisfaction (1-10)</label>
                <input type="range" id="qf-slider" min="1" max="10" value="5" style="width:100%;accent-color:var(--color-accent,#38bdf8);" oninput="document.getElementById('qf-slider-val').textContent=this.value">
                <span id="qf-slider-val" style="font-size:0.8rem;color:var(--text-muted,#94a3b8);">5</span>
                <label style="display:block;margin-top:0.5rem;margin-bottom:0.25rem;color:var(--text-muted,#94a3b8);font-size:0.8rem;">Comment (optional)</label>
                <textarea id="qf-comment" rows="2" style="width:100%;padding:0.4rem;border:1px solid var(--border,#334155);border-radius:6px;background:var(--surface,#1e293b);color:var(--text,#e2e8f0);font-size:0.85rem;resize:vertical;" placeholder="What could be improved?"></textarea>
                <button class="qf-submit-btn" onclick="window.submitQuestionFeedbackDetail()" style="margin-top:0.5rem;padding:0.35rem 1rem;border:none;border-radius:6px;background:var(--color-accent,#38bdf8);color:#0f172a;font-size:0.85rem;font-weight:600;cursor:pointer;">Submit</button>
              </div>
              <p id="qf-status" style="margin:0.35rem 0 0;font-size:0.8rem;color:var(--text-muted,#94a3b8);"></p>
            </div>`
                content.insertAdjacentHTML('beforeend', fbHtml)

                fetch(`/question-feedback/${fbQuestionId}`).then(r => r.json()).then(d => {
                    if (d.success && d.userFeedback) {
                        const statusEl = document.getElementById('qf-status')
                        const thumbsEl = content.querySelector('.qf-thumbs')
                        if (statusEl) statusEl.textContent = `You rated this ${d.userFeedback.satisfaction}/10 (${d.userFeedback.is_positive ? '👍' : '👎'})`
                        if (thumbsEl) thumbsEl.style.display = 'none'
                    }
                }).catch(() => {})

                window.submitQuestionFeedback = function (isPositive) {
                    const detail = document.getElementById('qf-detail')
                    if (detail) detail.style.display = 'block'
                    window._qfIsPositive = isPositive
                    document.querySelectorAll('.qf-thumbs .qf-btn').forEach(b => {
                        b.style.opacity = '0.4'
                        b.style.pointerEvents = 'none'
                    })
                    const activeBtn = isPositive ? document.querySelector('.qf-up') : document.querySelector('.qf-down')
                    if (activeBtn) { activeBtn.style.opacity = '1'; activeBtn.style.borderColor = 'var(--color-accent,#38bdf8)' }
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
            btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:0.4rem;"></span> Adding words...'
            status.textContent = "";
            try {
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
                    btn.innerHTML = isMarked ? '<img src="/img/icon-star.svg" alt="" width="14" height="14" style="vertical-align:-3px"> Marked' : '<img src="/img/icon-star-outline.svg" alt="" width="14" height="14" style="vertical-align:-3px"> Mark for Review';
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
