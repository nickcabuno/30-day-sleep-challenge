(function () {
  const MOOD_EMOJI = { great: '😄', good: '🙂', okay: '😐', poor: '😣' };
  const MOOD_LABEL = { great: 'Great', good: 'Good', okay: 'Okay', poor: 'Poor' };
  const ENERGY_LABEL = { low: 'Low energy', moderate: 'Moderate energy', high: 'High energy' };
  const STRATEGY_LABEL = {
    consistent_schedule: 'Consistent sleep schedule',
    screen_free_winddown: 'Screen-free wind-down',
    relaxation_routine: 'Relaxation routine',
    comfortable_environment: 'Comfortable sleep environment',
    academic_cutoff: 'Academic cutoff time'
  };
  const TIPS = [
    'Aim for a consistent bedtime and put your phone away 30 minutes before bed.',
    'Keep your room cool, dark, and quiet for deeper sleep.',
    'Avoid caffeine in the 6 hours before bedtime.',
    'A short wind-down routine signals your brain it’s time to rest.',
    'Natural light in the morning helps anchor your sleep schedule.',
    'Try to wake up at the same time every day, even on weekends.',
    'Save your bed for sleep — it helps your brain link the two.'
  ];

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

  let profile, startDate, todayStr, checkinsByDay = {};
  const LEN = window.SC_CONFIG.CHALLENGE_LENGTH_DAYS || 30;

  async function loadCheckins(userId) {
    const { data, error } = await SC.client.from('checkins').select('*').eq('user_id', userId);
    if (error) throw error;
    checkinsByDay = {};
    data.forEach((c) => (checkinsByDay[c.day] = c));
  }

  async function loadPoints(userId) {
    const { data, error } = await SC.client.rpc('get_leaderboard');
    if (error) throw error;
    const mine = data.find((r) => r.user_id === userId);
    return mine ? mine.points : 0;
  }

  function renderCalendar() {
    const cal = document.getElementById('calendar');
    cal.innerHTML = '';
    let completed = 0;

    for (let day = 1; day <= LEN; day++) {
      const date = addDays(startDate, day - 1);
      const dateStr = localDateStr(date);
      const cell = document.createElement('div');
      cell.className = 'day-cell';

      const checkin = checkinsByDay[day];
      if (checkin) {
        cell.classList.add('done');
        cell.addEventListener('click', () => openViewModal(day, checkin));
        completed++;
      } else if (dateStr === todayStr) {
        cell.classList.add('today');
        cell.addEventListener('click', () => { window.location.href = 'sleep-log.html'; });
      } else if (dateStr < todayStr) {
        cell.classList.add('missed');
      }

      cell.textContent = day;
      cal.appendChild(cell);
    }

    document.getElementById('progress-pct').textContent = `${Math.round((completed / LEN) * 100)}%`;
    document.getElementById('progress-fill').style.width = `${(completed / LEN) * 100}%`;
    return completed;
  }

  function openViewModal(day, checkin) {
    document.getElementById('modal-title').textContent = `Day ${day}`;
    document.getElementById('modal-sub').textContent = `Logged on ${checkin.entry_date}`;
    const strategies = (checkin.strategies || []).map((s) => STRATEGY_LABEL[s] || s);
    document.getElementById('modal-body').innerHTML = `
      <div class="q-block">
        <label>Bedtime &amp; wake-up</label>
        <div>${fmtTime(checkin.bedtime)} → ${fmtTime(checkin.wake_time)}</div>
      </div>
      <div class="q-block">
        <label>How they slept</label>
        <div>${MOOD_EMOJI[checkin.mood] || ''} ${MOOD_LABEL[checkin.mood] || checkin.mood}</div>
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
    document.getElementById('modal-backdrop').classList.add('show');
  }
  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('show');
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    profile = auth.profile;

    startDate = parseLocalDate(window.SC_CONFIG.CHALLENGE_START_DATE);
    todayStr = localDateStr(new Date());

    SC_SHELL.renderTabs('home');

    await loadCheckins(profile.id);
    const completed = renderCalendar();

    const points = await loadPoints(profile.id).catch(() => 0);
    SC_SHELL.renderHeader({
      title: "Get Your Z's",
      subtitle: 'Better nights. Brighter days. Together.',
      profile,
      chips: [
        { label: 'Your progress', value: `${completed}/${LEN}` },
        { label: 'Your points', value: `${points} ⭐` }
      ]
    });

    // Figure out whether "today" falls inside the challenge window.
    let todayDay = null;
    for (let day = 1; day <= LEN; day++) {
      if (localDateStr(addDays(startDate, day - 1)) === todayStr) todayDay = day;
    }
    const missionBtn = document.getElementById('mission-btn');
    const missionText = document.getElementById('mission-text');
    if (todayDay === null) {
      missionText.textContent = 'No challenge day is open for check-in right now.';
      missionBtn.style.display = 'none';
    } else {
      missionText.textContent = TIPS[(todayDay - 1) % TIPS.length];
      missionBtn.textContent = checkinsByDay[todayDay] ? "View today's check-in →" : "Complete today's check-in →";
      missionBtn.addEventListener('click', () => { window.location.href = 'sleep-log.html'; });
    }

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
  })();
})();
