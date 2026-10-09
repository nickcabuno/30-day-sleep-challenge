(function () {
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

  let profile, startDate, todayStr, checkinsByDay = {};
  let selectedDay = null, selectedRating = null, selectedHours = null;

  const LEN = window.SC_CONFIG.CHALLENGE_LENGTH_DAYS || 30;

  async function loadCheckins(userId) {
    const { data, error } = await SC.client
      .from('checkins')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    checkinsByDay = {};
    data.forEach((c) => (checkinsByDay[c.day] = c));
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

      const isDone = !!checkinsByDay[day];
      if (isDone) {
        cell.classList.add('done');
        completed++;
      } else if (dateStr === todayStr) {
        cell.classList.add('today');
        cell.addEventListener('click', () => openModal(day, dateStr));
      } else if (dateStr < todayStr) {
        cell.classList.add('missed');
      }

      cell.innerHTML = `<div class="num">${day}</div>`;
      cal.appendChild(cell);
    }

    document.getElementById('progress-line').textContent = `${completed} of ${LEN} days completed`;
  }

  function buildScale(containerId, onSelect) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i;
      b.addEventListener('click', () => {
        [...el.children].forEach((c) => c.classList.remove('sel'));
        b.classList.add('sel');
        onSelect(i);
      });
      el.appendChild(b);
    }
  }

  function openModal(day, dateStr) {
    selectedDay = day;
    selectedRating = null;
    selectedHours = null;
    document.getElementById('modal-title').textContent = `Day ${day} check-in`;
    document.getElementById('reasoning').value = '';
    document.getElementById('modal-error').classList.remove('show');
    buildScale('scale-rating', (v) => (selectedRating = v));
    buildScale('scale-hours', (v) => (selectedHours = v));
    document.getElementById('modal-backdrop').classList.add('show');
  }
  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('show');
  }

  async function submitCheckin() {
    const errBox = document.getElementById('modal-error');
    errBox.classList.remove('show');
    if (!selectedRating || !selectedHours) {
      errBox.textContent = 'Please answer both scale questions.';
      errBox.classList.add('show');
      return;
    }
    const btn = document.getElementById('modal-submit');
    btn.disabled = true;
    try {
      const { error } = await SC.client.from('checkins').insert({
        user_id: profile.id,
        day: selectedDay,
        entry_date: todayStr,
        sleep_rating: selectedRating,
        hours_slept: selectedHours,
        reasoning: document.getElementById('reasoning').value.trim()
      });
      if (error) throw error;
      closeModal();
      await loadCheckins(profile.id);
      renderCalendar();
    } catch (err) {
      errBox.textContent = err.message || 'Could not save check-in.';
      errBox.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    profile = auth.profile;

    startDate = parseLocalDate(window.SC_CONFIG.CHALLENGE_START_DATE);
    todayStr = localDateStr(new Date());
    document.getElementById('page-title').textContent = startDate.toLocaleString('en-US', { month: 'long' });

    SC_NAV.render('challenge', profile);

    await loadCheckins(profile.id);
    renderCalendar();

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-submit').addEventListener('click', submitCheckin);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
  })();
})();
