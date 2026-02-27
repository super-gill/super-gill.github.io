(() => {
  'use strict';
  const {update}=window.SIM;
  const {draw}=window.R;
  const {game}=window.G;
  function step(){
    const t=performance.now();
    const dt=Math.min(0.033,(t-game.lastT)/1000);
    game.lastT=t;
    update(dt);
    draw();
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
