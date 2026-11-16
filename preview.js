const duration = 15000;
const connectingDelay = 450;

export function createPreviewPlayer(update) {
  let current;
  let connection;
  let frame;
  const completed = new Set();

  function elapsed() {
    const running = current.status==='playing' ? performance.now()-current.startedAt : 0;
    return Math.min(duration,current.offset+running);
  }

  function state(id) {
    if (current?.id===id) return {status:current.status,elapsed:elapsed()/1000};
    return {status:completed.has(id)?'completed':'idle',elapsed:0};
  }

  function stop() {
    clearTimeout(connection);
    cancelAnimationFrame(frame);
    current=undefined;
  }

  function tick() {
    if (elapsed()>=duration) {
      completed.add(current.id);
      current=undefined;
      update();
      return;
    }
    update();
    frame=requestAnimationFrame(tick);
  }

  function play() {
    current.status='playing';
    current.startedAt=performance.now();
    tick();
  }

  function toggle(item) {
    if (current?.id===item.id) {
      if (current.status==='playing') {
        current.offset=elapsed();
        current.status='paused';
        cancelAnimationFrame(frame);
        update();
      } else if (current.status==='paused') {
        play();
      }
      return;
    }
    stop();
    completed.delete(item.id);
    current={id:item.id,status:'connecting',offset:0};
    update();
    connection=setTimeout(play,connectingDelay);
  }

  return {state,toggle,stop};
}
