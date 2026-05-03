import { globalData } from "../data/globalData";

let audioCtx: AudioContext | null = null;
let bgmTimerID: number | null = null;
let nextNoteTime = 0;
let bgmStep = 0;

function scheduleNote(step: number, time: number) {
    if (!audioCtx) return;
    const vol = globalData.settings.volume * 0.015; // Background volume
    if (vol <= 0) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Simple 8-note melody loop
    const notes = [ 329.63, 392.00, 440.00, 523.25, 587.33, 523.25, 440.00, 392.00 ];
    osc.type = "triangle";
    osc.frequency.setValueAtTime(notes[step % notes.length], time);
    
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    osc.start(time);
    osc.stop(time + 0.2);
}

function scheduler() {
    if (!audioCtx || audioCtx.state === 'suspended') {
        bgmTimerID = window.setTimeout(scheduler, 100);
        return;
    }
    
    // Schedule ahead
    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        scheduleNote(bgmStep, nextNoteTime);
        nextNoteTime += 0.25; // 4 notes per second
        bgmStep++;
    }
    bgmTimerID = window.setTimeout(scheduler, 25);
}

export function startBGM() {
    if (!audioCtx) initAudio();
    if (bgmTimerID !== null) return;
    
    if (audioCtx) {
        nextNoteTime = audioCtx.currentTime + 0.1;
    }
    scheduler();
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    startBGM(); // Start BGM as soon as user unlocks audio
}

window.addEventListener('mousedown', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

export function playSound(type: 'jump' | 'shoot' | 'melee' | 'hit' | 'click' | 'bossHit', volume: number = 1) {
    try {
        if (!audioCtx) initAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        
        const finalVol = volume * globalData.settings.volume;
        if (finalVol <= 0 || !audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        // Increased base volumes to make them clearly audible
        if (type === 'jump') {
            osc.type = "sine";
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
            gain.gain.setValueAtTime(finalVol * 0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'click') {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gain.gain.setValueAtTime(finalVol * 0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'shoot') {
            osc.type = "square";
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
            gain.gain.setValueAtTime(finalVol * 0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'melee') {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
            gain.gain.setValueAtTime(finalVol * 0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'hit') {
            osc.type = "square";
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(finalVol * 0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'bossHit') {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
            gain.gain.setValueAtTime(finalVol * 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        // ignore
    }
}
