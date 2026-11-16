(() => {
  const version = document.currentScript?.dataset.prototypeVersion;
  const screen = document.querySelector('#screen');
  const navigation = document.querySelector('#navigation');
  const phone = screen?.closest('.device');
  if (!['A', 'B'].includes(version) || !phone || !navigation) return;

  const tasks = {
    audience: {
      title: 'Task 1 — Audience',
      instruction: "Find Hubble-Lemaître's performance through the Browse page and open the page where you can tip the performer. You do not need to send a tip.",
      reachedGoal: () =>
        screen.querySelector('.ticket-cover h1')?.textContent.trim() === 'Hubble-Lemaître' &&
        screen.querySelector('.ticket .now span')?.textContent.trim() === 'Mr.BrightLight'
    },
    performer: {
      title: 'Task 2 — Performer',
      instruction: 'Start a performance as a performer and continue until you reach the active performance countdown screen.',
      reachedGoal: () => Boolean(screen.querySelector('.active #countdown'))
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    #corner-set-test-panel {
      position: absolute;
      inset: max(70px, calc(50dvh - 389px)) calc(50% + 313px) auto auto;
      width: min(290px, calc(50% - 329px));
      max-height: min(828px, calc(100dvh - 84px));
      overflow: auto;
      background: transparent;
      color: #363636;
      font: 14px/1.45 system-ui, sans-serif;
    }
    #corner-set-test-panel h2,
    #corner-set-test-panel h3 { margin: 0; font: 700 1em/1.3 system-ui, sans-serif; }
    #corner-set-test-panel h2 { font-size: 17px; }
    #corner-set-test-panel p { margin: 6px 0 0; }
    #corner-set-test-panel section { border-top: 1px solid #0002; margin-top: 14px; padding-top: 14px; }
    #corner-set-test-panel dl { margin: 8px 0 0; font-variant-numeric: tabular-nums; }
    #corner-set-test-panel dl div { display: flex; gap: 4px; }
    #corner-set-test-panel dd { margin: 0; }
    #corner-set-test-panel [data-complete] { color: #14613a; font-weight: 700; }
    @media (min-width: 980px) and (max-width: 1099px) {
      #corner-set-test-panel {
        right: calc(50% + 213px + clamp(54px, calc(38.33vw - 321.67px), 100px));
        width: 205px;
      }
    }
    @media (max-width: 979px) {
      #corner-set-test-panel {
        inset: calc(100dvh + 12px) auto auto 50%;
        width: min(426px, calc(100% - 24px));
        max-height: none;
        transform: translateX(-50%);
      }
    }
  `;
  document.head.append(style);

  const panel = document.createElement('aside');
  panel.id = 'corner-set-test-panel';
  panel.setAttribute('aria-labelledby', 'corner-set-test-title');
  panel.innerHTML = `
    <h2 id="corner-set-test-title">Corner Set — Usability Test</h2>
    <p>Prototype Version: ${version}</p>
    ${Object.entries(tasks).map(([role, task]) => `
      <section data-task="${role}">
        <h3>${task.title}</h3>
        <p>${task.instruction}</p>
        <dl>
          <div><dt>Status:</dt><dd data-status aria-live="polite">Not completed</dd></div>
          <div><dt>Clicks:</dt><dd data-clicks>0</dd></div>
          <div><dt>Time:</dt><dd data-time>00:00</dd></div>
        </dl>
        ${role === 'audience' ? '<p data-route-feedback role="status" hidden></p>' : ''}
      </section>
    `).join('')}
    <p data-finished role="status"></p>
  `;
  document.body.append(panel);

  for (const [role, task] of Object.entries(tasks)) {
    const section = panel.querySelector(`[data-task="${role}"]`);
    task.status = section.querySelector('[data-status]');
    task.counter = section.querySelector('[data-clicks]');
    task.timer = section.querySelector('[data-time]');
    task.clicks = 0;
    task.started = null;
    task.finished = null;
  }

  const summary = panel.querySelector('[data-finished]');
  const routeFeedback = panel.querySelector('[data-route-feedback]');
  const displayTime = (task, now) => {
    const seconds = task.started === null ? 0 : Math.floor(((task.finished ?? now) - task.started) / 1000);
    const time = [Math.floor(seconds / 60), seconds % 60].map(part => String(part).padStart(2, '0')).join(':');
    if (task.timer.textContent !== time) task.timer.textContent = time;
  };

  let currentRole;
  let audienceView;
  let openedFromBrowse = false;

  function trackAudienceRoute(role) {
    const view = role !== 'audience' ? null
      : screen.querySelector('.audience-browse') ? 'browse'
        : screen.querySelector('.ticket') ? 'ticket'
          : screen.querySelector('.details') ? 'detail' : 'other';
    if (view === audienceView) return;
    if (view === 'detail' && audienceView !== 'ticket') openedFromBrowse = audienceView === 'browse';
    else if (view !== 'detail' && view !== 'ticket') openedFromBrowse = false;
    audienceView = view;
  }

  function synchronize(now = performance.now()) {
    // Both versions render the role's navigation even when it is hidden on detail pages.
    const role = navigation.querySelector('[data-action="tab:discover"]') ? 'audience'
      : navigation.querySelector('[data-action="tab:home"]') ? 'performer' : null;
    if (role !== currentRole) {
      const previous = tasks[currentRole];
      if (previous && previous.finished === null) {
        previous.clicks = 0;
        previous.started = null;
        previous.counter.textContent = '0';
        displayTime(previous, now);
      }
      currentRole = role;
    }
    trackAudienceRoute(role);
    const task = tasks[role];
    const reachedGoal = Boolean(task && task.finished === null && task.reachedGoal());
    const wrongRoute = role === 'audience' && reachedGoal && !openedFromBrowse;
    if (wrongRoute && routeFeedback.hidden) {
      routeFeedback.hidden = false;
      routeFeedback.textContent = 'Please find the performer through Browse.';
    } else if (!wrongRoute && !routeFeedback.hidden) {
      routeFeedback.hidden = true;
      routeFeedback.textContent = '';
    }
    if (!reachedGoal || wrongRoute) return;
    task.finished = now;
    task.status.textContent = '✓ Completed';
    task.status.setAttribute('data-complete', '');
    displayTime(task, now);
    if (Object.values(tasks).every(item => item.finished !== null)) {
      summary.textContent = 'All tasks completed. Please record your results and continue to the questionnaire.';
    }
  }

  // Observe page replacement only. Countdown and preview text updates do not
  // replace either container and do not affect task state.
  const observer = new MutationObserver(() => synchronize());
  observer.observe(screen, { childList: true });
  observer.observe(navigation, { childList: true });
  synchronize();
  setInterval(() => {
    const task = tasks[currentRole];
    if (task && task.started !== null && task.finished === null) displayTime(task, performance.now());
  }, 200);

  let gesture;
  window.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }, true);
  function checkMovement(event) {
    if (gesture?.id === event.pointerId &&
      Math.max(Math.abs(event.clientX - gesture.x), Math.abs(event.clientY - gesture.y)) >= 5) {
      gesture.moved = true;
    }
  }
  window.addEventListener('pointermove', checkMovement, true);
  window.addEventListener('pointerup', checkMovement, true);
  window.addEventListener('pointercancel', event => {
    if (gesture?.id === event.pointerId) gesture.moved = true;
  }, true);
  phone.addEventListener('click', event => {
    // Capture once before the app handles the click so the final action counts.
    // Keyboard activation also produces a click and has no pointer gesture.
    if (!event.isTrusted || event.button !== 0 || (event.detail > 0 && gesture?.moved)) return;
    const now = performance.now();
    synchronize(now);
    const task = tasks[currentRole];
    if (!task || task.finished !== null) return;
    task.started ??= now;
    task.counter.textContent = String(++task.clicks);
  }, true);
})();
