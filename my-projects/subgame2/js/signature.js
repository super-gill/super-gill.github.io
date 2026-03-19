(() => {
  'use strict';
  const C=window.CONFIG; const {clamp}=window.M; const {world,player}=window.G; const I=window.I;
  function cavitationThresholdKts(depth){
    const d=clamp((depth-world.seaLevel)/C.player.cavitationDepthRef,0,2.0);
    return C.player.cavitationKtsRef + d*(C.player.cavitationDepthRef*C.player.cavitationSlope);
  }
  let _lastDesiredHeading = null;
  function updateNoise(dt){
    const flow=(player.speed/C.player.flowNoiseDiv);
    let n=clamp(C.player.noiseFloor+flow,0,1);
    const turnMag=Math.min(1,Math.abs(player.turnRate)/(Math.PI/3));
    // Course reversal transient
    if(_lastDesiredHeading===null) _lastDesiredHeading = (player.desiredHeading ?? 0);
    if(Math.abs((_lastDesiredHeading) - (player.desiredHeading ?? 0)) > 1e-3){
      player.noiseTransient = Math.min(1, player.noiseTransient + (C.player.turnSnapNoise || 0.10));
      _lastDesiredHeading = (player.desiredHeading ?? 0);
    }
    n=clamp(n+turnMag*C.player.turnNoise,0,1);
    if(window.PANEL?.getTelegraph()?.kts >= (C.player.flankKts||28)) n=clamp(n+C.player.flankNoiseBoost,0,1);
    const cavK=cavitationThresholdKts(player.depth);
    player.cavitating=(player.speed>cavK);
    if(player.cavitating) n=clamp(n+C.player.cavitationSpike,0,1);
    if(player.silent) n*=C.player.silentRunning.noiseMult;
    if(player.snorkeling && C.player.snorkelNoise) n=clamp(n+C.player.snorkelNoise,0,1);
    // Suppress natural decay while HP recharge compressor is running
    const _rechg = window.G?.player?.damage?.hpa?.recharging;
    if(!_rechg) player.noiseTransient=Math.max(0,player.noiseTransient-dt*0.35);
    n=clamp(n+player.noiseTransient,0,1);
    // Flooding pumps add to acoustic signature
    const floodPenalty = window.DMG?.getEffects().noisePenalty||0;
    player.noise=clamp(n+floodPenalty,0,1);
  }
  window.SIG={updateNoise,cavitationThresholdKts};
})();
