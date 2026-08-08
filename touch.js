(() => {
  const studio = window.ShowduinoStudio;
  if (!studio) return;

  const viewport = document.getElementById('timelineViewport');
  const canvas = document.getElementById('timelineCanvas');
  const library = document.getElementById('libraryContent');

  let pinch = null;
  let libraryDrag = null;

  function distance(a, b) {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function midpoint(a, b) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  viewport.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;
    const mid = midpoint(event.touches[0], event.touches[1]);
    pinch = {
      startDistance: distance(event.touches[0], event.touches[1]),
      startZoom: studio.state.zoom,
      midpointX: mid.x
    };
    event.preventDefault();
  }, { passive: false });

  viewport.addEventListener('touchmove', event => {
    if (!pinch || event.touches.length !== 2) return;
    const d = distance(event.touches[0], event.touches[1]);
    const mid = midpoint(event.touches[0], event.touches[1]);
    const scale = d / Math.max(1, pinch.startDistance);
    studio.setZoom(pinch.startZoom * scale, mid.x);
    event.preventDefault();
  }, { passive: false });

  viewport.addEventListener('touchend', event => {
    if (event.touches.length < 2) pinch = null;
  }, { passive: true });

  viewport.addEventListener('touchcancel', () => { pinch = null; }, { passive: true });

  library.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    const item = event.target.closest('.library-item');
    if (!item) return;

    const ghost = item.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.zIndex = '500';
    ghost.style.width = `${item.getBoundingClientRect().width}px`;
    ghost.style.opacity = '.88';
    ghost.style.pointerEvents = 'none';
    ghost.style.transform = 'scale(.96)';
    document.body.appendChild(ghost);

    libraryDrag = {
      pointerId: event.pointerId,
      type: item.dataset.type,
      ghost,
      moved: false,
      startX: event.clientX,
      startY: event.clientY
    };
    moveGhost(event.clientX, event.clientY);
    item.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  window.addEventListener('pointermove', event => {
    if (!libraryDrag || event.pointerId !== libraryDrag.pointerId) return;
    if (Math.hypot(event.clientX - libraryDrag.startX, event.clientY - libraryDrag.startY) > 8) libraryDrag.moved = true;
    moveGhost(event.clientX, event.clientY);
    document.querySelectorAll('.lane.drag-over').forEach(lane => lane.classList.remove('drag-over'));
    document.elementFromPoint(event.clientX, event.clientY)?.closest('.lane')?.classList.add('drag-over');
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('pointerup', event => {
    if (!libraryDrag || event.pointerId !== libraryDrag.pointerId) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const lane = element?.closest('.lane');

    if (lane) {
      const rect = canvas.getBoundingClientRect();
      const start = Math.max(0, (event.clientX - rect.left) / studio.state.pixelsPerSecond);
      studio.addClipFromLibrary(libraryDrag.type, lane.dataset.trackId, start);
      document.getElementById('libraryPanel')?.classList.remove('open');
    } else if (!libraryDrag.moved) {
      studio.addClipFromLibrary(libraryDrag.type);
    }

    cleanupLibraryDrag();
  });

  window.addEventListener('pointercancel', cleanupLibraryDrag);

  function moveGhost(x, y) {
    if (!libraryDrag) return;
    libraryDrag.ghost.style.left = `${x + 12}px`;
    libraryDrag.ghost.style.top = `${y + 12}px`;
  }

  function cleanupLibraryDrag() {
    if (!libraryDrag) return;
    libraryDrag.ghost.remove();
    document.querySelectorAll('.lane.drag-over').forEach(lane => lane.classList.remove('drag-over'));
    libraryDrag = null;
  }
})();
