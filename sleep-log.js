(function () {
  const MOODS = [
    { v: 'great', emoji: '😄', label: 'Great' },
    { v: 'good', emoji: '🙂', label: 'Good' },
    { v: 'okay', emoji: '😐', label: 'Okay' },
    { v: 'poor', emoji: '😣', label: 'Poor' }
  ];
  const STRATEGIES = [
    { v: 'consistent_schedule', label: 'Consistent sleep schedule' },
    { v: 'screen_free_winddown', label: 'Screen-free wind-down' },
    { v: 'relaxation_routine', label: 'Relaxation routine' },
    { v: 'comfortable_environment', label: 'Comfortable sleep environment' },
    { v: 'academic_cutoff', label: 'Academic cutoff time' }
  ];
  const MOOD_MAP = Object.fromEntries(MOODS.map((m) => [m.v, m]));
  const ENERGY_LABEL = { low: 'Low energy', moderate: 'Moderate energy', high: 'High energy' };
  const STRATEGY_LABEL = Object.fromEntries(STRATEGIES.map((s) => [s.v, s.label]));

  function parseLocalDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function localDateStr(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  let profile, startDate, todayStr, selectedMood = null, selectedStrategies = new Set();

  const LEN = window.SC_CONFIG.CHALLENGE_LENGTH_DAYS || 30;

  function dayForDate(dateStr) {
    for (let day = 1; day <= LEN; day++) {
      if (localDateStr(addDays(startDate, day - 1)) === dateStr) return day;
    }
    return null;
  }

  function buildMoodRow() {
    const el = document.getElementById('mood-row');
    el.innerHTML = '';
    MOODS.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mood-btn';
      b.innerHTML = `<span class="emoji">${m.emoji}</span><span>${m.label}</span>`;
      b.addEventListener('click', () => {
        selectedMood = m.v;
        [...el.children].forEach((c) => c.classList.remove('sel'));
        b.classList.add('sel');
      });
      el.appendChild(b);
    });
  }

  function buildStrategyList() {
    const el = document.getElementById('strategy-list');
    el.innerHTML = '';
    STRATEGIES.forEach((s) => {
      const row = document.createElement('label');
      row.className = 'strategy-item';
      row.innerHTML = `<input type="checkbox" value="${s.v}" /><span>${s.label}</span>`;
      const input = row.querySelector('input');
      input.addEventListener('change', () => {
        if (input.checked) selectedStrategies.add(s.v);
        else selectedStrategies.delete(s.v);
        row.classList.toggle('checked', input.checked);
      });
      el.appendChild(row);
    });
  }

  function entrySummaryHtml(checkin) {
    const strategies = (checkin.strategies || []).map((s) => STRATEGY_LABEL[s] || s);
    return `
      <div class="q-block">
        <label>Bedtime &amp; wake-up</label>
        <div>${fmtTime(checkin.bedtime)} → ${fmtTime(checkin.wake_time)}</div>
      </div>
      <div class="q-block">
        <label>How they slept</label>
        <div>${(MOOD_MAP[checkin.mood] || {}).emoji || ''} ${(MOOD_MAP[checkin.mood] || {}).label || checkin.mood}</div>
      </div>
      <div class="q-block">
        <label>Strategies practiced</label>
        <div>${strategies.length ? strategies.join(', ') : '—'}</div>
      </div>
      <div class="q-block">
        <label>Energy during the day</label>
        <div>${ENERGY_LABEL[checkin.energy] || checkin.energy}</div>
      </div>
    `;
  }

  function openViewModal(day, checkin) {
    document.getElementById('modal-title').textContent = `Day ${day}`;
    document.getElementById('modal-sub').textContent = `Logged on ${checkin.entry_date}`;
    document.getElementById('modal-body').innerHTML = entrySummaryHtml(checkin);
    document.getElementById('modal-backdrop').classList.add('show');
  }
  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('show');
  }

  function renderEntries(checkins) {
    const el = document.getElementById('entry-list');
    if (checkins.length === 0) {
      el.innerHTML = '<div class="empty-state">No entries yet — your first check-in will show up here.</div>';
      return;
    }
    const sorted = [...checkins].sort((a, b) => b.day - a.day);
    el.innerHTML = '';
    sorted.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'entry-row';
      const mood = MOOD_MAP[c.mood] || { label: c.mood };
      row.innerHTML = `
        <div class="er-left">
          <span class="er-day">Day ${c.day}</span>
          <span>${fmtTime(c.bedtime)} – ${fmtTime(c.wake_time)}</span>
          <div class="er-meta">${(c.strategies || []).length} strategies &middot; ${ENERGY_LABEL[c.energy] || c.energy}</div>
        </div>
        <span class="mood-pill ${c.mood}">${mood.label}</span>
      `;
      row.addEventListener('click', () => openViewModal(c.day, c));
      el.appendChild(row);
    });
  }

  async function saveCheckin(day) {
    const errBox = document.getElementById('log-error');
    errBox.classList.remove('show');
    const bedtime = document.getElementById('in-bedtime').value;
    const waketime = document.getElementById('in-waketime').value;
    const energy = document.getElementById('in-energy').value;
    if (!bedtime || !waketime || !selectedMood || !energy) {
      errBox.textContent = 'Please fill in bedtime, wake-up time, mood, and energy.';
      errBox.classList.add('show');
      return;
    }
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    try {
      const { error } = await SC.client.from('checkins').insert({
        user_id: profile.id,
        day,
        entry_date: todayStr,
        bedtime,
        wake_time: waketime,
        mood: selectedMood,
        strategies: [...selectedStrategies],
        energy
      });
      if (error) throw error;
      await load();
    } catch (err) {
      errBox.textContent = err.message || 'Could not save check-in.';
      errBox.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  }

  async function load() {
    const { data, error } = await SC.client.from('checkins').select('*').eq('user_id', profile.id);
    if (error) throw error;
    renderEntries(data);

    const todayDay = dayForDate(todayStr);
    const todaysCheckin = todayDay ? data.find((c) => c.day === todayDay) : null;
    const checkinCard = document.getElementById('checkin-card');
    const doneCard = document.getElementById('done-card');

    if (!todayDay) {
      checkinCard.style.display = 'none';
      doneCard.style.display = 'none';
    } else if (todaysCheckin) {
      checkinCard.style.display = 'none';
      doneCard.style.display = '';
    } else {
      checkinCard.style.display = '';
      doneCard.style.display = 'none';
    }
    return todayDay;
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    profile = auth.profile;

    startDate = parseLocalDate(window.SC_CONFIG.CHALLENGE_START_DATE);
    todayStr = localDateStr(new Date());

    SC_SHELL.renderHeader({ title: 'Sleep Log', subtitle: 'Log tonight, see your history below.', profile });
    SC_SHELL.renderTabs('sleep-log');

    buildMoodRow();
    buildStrategyList();
    const todayDay = await load();

    document.getElementById('save-btn').addEventListener('click', () => saveCheckin(todayDay));
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
  })();
})();
