(function () {
  let profile, activePoll = null, optionInputCount = 0;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function addOptionInput(value) {
    optionInputCount++;
    const wrap = document.getElementById('new-poll-options');
    const row = document.createElement('div');
    row.className = 'option-input-row';
    row.innerHTML = `<input type="text" placeholder="Option ${optionInputCount}" value="${value ? escapeHtml(value) : ''}" /><button type="button" aria-label="Remove">✕</button>`;
    row.querySelector('button').addEventListener('click', () => row.remove());
    wrap.appendChild(row);
  }

  async function createPoll() {
    const errBox = document.getElementById('poll-create-error');
    errBox.classList.remove('show');
    const question = document.getElementById('new-poll-question').value.trim();
    const optionInputs = [...document.querySelectorAll('#new-poll-options input')]
      .map((i) => i.value.trim())
      .filter(Boolean);
    if (!question || optionInputs.length < 2) {
      errBox.textContent = 'Add a question and at least two options.';
      errBox.classList.add('show');
      return;
    }
    const btn = document.getElementById('create-poll-btn');
    btn.disabled = true;
    try {
      const { data: poll, error: pollErr } = await SC.client
        .from('polls')
        .insert({ question, created_by: profile.id })
        .select()
        .single();
      if (pollErr) throw pollErr;
      const rows = optionInputs.map((label, i) => ({ poll_id: poll.id, label, position: i }));
      const { error: optErr } = await SC.client.from('poll_options').insert(rows);
      if (optErr) throw optErr;
      document.getElementById('new-poll-question').value = '';
      document.getElementById('new-poll-options').innerHTML = '';
      optionInputCount = 0;
      addOptionInput(); addOptionInput();
      await loadPoll();
    } catch (err) {
      errBox.textContent = err.message || 'Could not create poll.';
      errBox.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  }

  async function castVote(optionId) {
    await SC.client.from('poll_votes').upsert(
      { poll_id: activePoll.id, option_id: optionId, user_id: profile.id },
      { onConflict: 'poll_id,user_id' }
    );
    await loadPoll();
  }

  function renderVoteButtons(options) {
    const body = document.getElementById('poll-body');
    body.innerHTML = options
      .map((o) => `<div class="poll-option"><button class="poll-option-btn" data-id="${o.id}">${escapeHtml(o.label)}</button></div>`)
      .join('');
    body.querySelectorAll('.poll-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => castVote(btn.dataset.id));
    });
  }

  function renderResults(options, votes, myOptionId) {
    const total = votes.length;
    const countByOption = {};
    votes.forEach((v) => (countByOption[v.option_id] = (countByOption[v.option_id] || 0) + 1));

    const body = document.getElementById('poll-body');
    body.innerHTML = options
      .map((o) => {
        const count = countByOption[o.id] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const mine = o.id === myOptionId;
        return `
          <div class="poll-result ${mine ? 'mine' : ''}">
            <div class="poll-result-head"><span>${escapeHtml(o.label)}${mine ? ' ✓' : ''}</span><span class="pct">${pct}%</span></div>
            <div class="poll-result-track"><div class="poll-result-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      })
      .join('') + `<button class="btn secondary small" id="change-vote-btn" type="button" style="margin-top:8px;">Change Your Vote</button>`;
    document.getElementById('change-vote-btn').addEventListener('click', () => renderVoteButtons(options));
  }

  async function loadReflection() {
    const card = document.getElementById('reflection-card');
    if (!activePoll) { card.style.display = 'none'; return; }
    card.style.display = '';
    const { data } = await SC.client
      .from('poll_reflections')
      .select('*')
      .eq('poll_id', activePoll.id)
      .eq('user_id', profile.id)
      .maybeSingle();
    document.getElementById('reflection-input').value = data ? data.body : '';
  }

  async function saveReflection() {
    const body = document.getElementById('reflection-input').value.trim();
    if (!body || !activePoll) return;
    const btn = document.getElementById('save-reflection-btn');
    btn.disabled = true;
    try {
      await SC.client.from('poll_reflections').upsert(
        { poll_id: activePoll.id, user_id: profile.id, body },
        { onConflict: 'poll_id,user_id' }
      );
    } finally {
      btn.disabled = false;
    }
  }

  async function loadPoll() {
    const { data: polls, error: pollErr } = await SC.client
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (pollErr) throw pollErr;
    activePoll = polls[0] || null;

    if (!activePoll) {
      document.getElementById('poll-question').textContent = 'No poll yet';
      document.getElementById('poll-body').innerHTML = '<div class="empty-state">Check back soon — nothing posted yet.</div>';
      document.getElementById('reflection-card').style.display = 'none';
      return;
    }

    document.getElementById('poll-question').textContent = activePoll.question;

    const [optionsRes, votesRes] = await Promise.all([
      SC.client.from('poll_options').select('*').eq('poll_id', activePoll.id).order('position'),
      SC.client.from('poll_votes').select('*').eq('poll_id', activePoll.id)
    ]);
    if (optionsRes.error) throw optionsRes.error;
    if (votesRes.error) throw votesRes.error;
    const options = optionsRes.data;
    const votes = votesRes.data;
    const myVote = votes.find((v) => v.user_id === profile.id);

    if (myVote) renderResults(options, votes, myVote.option_id);
    else renderVoteButtons(options);

    await loadReflection();
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    profile = auth.profile;

    SC_SHELL.renderHeader({ title: 'Polls', subtitle: 'Discover what other students enjoy.', profile });
    SC_SHELL.renderTabs('polls');

    if (profile.is_admin) {
      document.getElementById('admin-create-card').style.display = '';
      addOptionInput(); addOptionInput();
      document.getElementById('add-option-btn').addEventListener('click', () => addOptionInput());
      document.getElementById('create-poll-btn').addEventListener('click', createPoll);
    }

    document.getElementById('save-reflection-btn').addEventListener('click', saveReflection);

    await loadPoll();
  })();
})();
