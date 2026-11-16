export function enableDragScroll(screen) {
  let gesture;
  let blockClick = false;

  screen.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    blockClick = false;
    if (event.target.closest('.map, .sheet-grip, input, select, textarea, [contenteditable]')) return;
    const row = event.target.closest('.carousel, .chips');
    const vertical = event.target.closest('.sheet-cards') || screen;
    if (!row && vertical.scrollHeight <= vertical.clientHeight) return;
    gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,row,
      left:row?.scrollLeft,vertical,top:vertical.scrollTop};
  });
  window.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.axis) {
      if (Math.max(Math.abs(dx),Math.abs(dy)) < 7) return;
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      blockClick = true;
      screen.classList.add('dragging');
      screen.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    if (gesture.axis === 'horizontal') {
      if (gesture.row) gesture.row.scrollLeft = gesture.left - dx;
    } else gesture.vertical.scrollTop = gesture.top - dy;
  }, {passive:false});
  function release(event) {
    if (gesture?.id !== event.pointerId) return;
    gesture = undefined;
    screen.classList.remove('dragging');
    if (screen.hasPointerCapture(event.pointerId)) screen.releasePointerCapture(event.pointerId);
  }
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  screen.addEventListener('lostpointercapture',release);
  screen.addEventListener('dragstart',event=>event.preventDefault());
  screen.addEventListener('click',event=>{
    if (!blockClick || event.detail === 0) return;
    blockClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
}
