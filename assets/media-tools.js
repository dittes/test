const MAX_RECORDING_MS = 15_000;

export const mediaToolHelpers = {
  rms(samples) {
    if (!samples?.length) return 0;
    let sum = 0;
    for (const value of samples) sum += value * value;
    return Math.sqrt(sum / samples.length);
  },

  dbfs(rms) {
    if (!Number.isFinite(rms) || rms <= 0) return -Infinity;
    return 20 * Math.log10(Math.min(1, rms));
  },

  formatDbfs(value) {
    if (!Number.isFinite(value) || value < -90) return 'below −90 dBFS';
    return `${Math.round(value)}`.replace('-', '−') + ' dBFS';
  },

  isCurrentSession(token, currentToken, activeStream, candidate, destroyed = false) {
    return !destroyed && token === currentToken && activeStream === candidate;
  },

  errorMessage(error, deviceName) {
    const label = deviceName || 'device';
    switch (error?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return `Permission for this ${label} was not granted. Allow access in your browser settings, then try again.`;
      case 'NotFoundError':
        return `No ${label} was found. Connect one, check its system settings, then try again.`;
      case 'NotReadableError':
        return `This ${label} is unavailable right now. Another app or browser tab may be using it.`;
      case 'OverconstrainedError':
        return `The selected ${label} could not provide the requested stream. Choose another ${label} and try again.`;
      case 'AbortError':
        return `The ${label} request was interrupted. Try again.`;
      default:
        return `This browser could not start the ${label}. Check that the page uses HTTPS and try again.`;
    }
  },
};

export function mountMediaTool(root, kind) {
  if (!root || !['webcam', 'microphone', 'headphone'].includes(kind)) {
    throw new Error('mountMediaTool needs a root element and a supported media-tool kind.');
  }

  root.__mediaToolDestroy?.();
  const tool = kind === 'webcam'
    ? mountWebcam(root)
    : kind === 'microphone'
      ? mountMicrophone(root)
      : mountHeadphones(root);
  root.__mediaToolDestroy = tool.destroy;
  return tool;
}

function hasMediaDevices() {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

function setStatus(root, text, tone = 'neutral') {
  const element = root.querySelector('[data-status]');
  if (!element) return;
  element.textContent = text;
  element.dataset.tone = tone;
}

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function fillDeviceSelect(select, devices, selectedId, noun) {
  select.replaceChildren();
  devices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `${noun} ${index + 1}`;
    option.selected = device.deviceId === selectedId;
    select.append(option);
  });
  select.disabled = devices.length < 2;
}

function bindLifecycle(cleanup) {
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') cleanup();
  };
  const onPageHide = () => cleanup();
  document.addEventListener('visibilitychange', onVisibilityChange);
  globalThis.addEventListener?.('pagehide', onPageHide);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    globalThis.removeEventListener?.('pagehide', onPageHide);
  };
}

function mountWebcam(root) {
  root.innerHTML = `
    <section class="tool-stage tool-stage-camera" aria-label="Webcam test">
      <div class="camera-frame" data-camera-frame>
        <video data-preview autoplay muted playsinline aria-label="Your camera preview"></video>
        <p class="camera-placeholder" data-placeholder>Your camera stays off until you start the test.</p>
      </div>
      <div class="tool-controls">
        <button class="button" type="button" data-start>Start camera</button>
        <button class="button-secondary" type="button" data-cancel hidden>Cancel request</button>
        <button class="button-secondary" type="button" data-stop hidden>Stop camera</button>
        <label class="field" data-device-field hidden>Camera
          <select data-device aria-label="Choose camera"></select>
        </label>
        <label class="field field-inline" data-mirror-field hidden><input type="checkbox" data-mirror checked> Mirror preview</label>
      </div>
      <p class="status" data-status role="status" aria-live="polite">Ready to start. Video is processed in this browser.</p>
      <div class="measurement-grid" data-measurements hidden>
        <div class="measurement"><span>Stream size</span><strong data-size>—</strong></div>
        <div class="measurement"><span>Aspect ratio</span><strong data-aspect>—</strong></div>
        <div class="measurement"><span>Frame-rate setting</span><strong data-rate>—</strong></div>
      </div>
      <p class="help-note">This checks whether your browser receives a video stream. It does not judge image quality or camera condition.</p>
    </section>`;

  const preview = root.querySelector('[data-preview]');
  const start = root.querySelector('[data-start]');
  const cancel = root.querySelector('[data-cancel]');
  const stop = root.querySelector('[data-stop]');
  const select = root.querySelector('[data-device]');
  const mirror = root.querySelector('[data-mirror]');
  const deviceField = root.querySelector('[data-device-field]');
  const mirrorField = root.querySelector('[data-mirror-field]');
  const measurements = root.querySelector('[data-measurements]');
  const placeholder = root.querySelector('[data-placeholder]');
  let stream = null;
  let requestToken = 0;
  let destroyed = false;

  const renderSettings = () => {
    const settings = stream?.getVideoTracks?.()[0]?.getSettings?.() || {};
    root.querySelector('[data-size]').textContent = settings.width && settings.height ? `${settings.width} × ${settings.height}` : 'Reported by browser: unavailable';
    root.querySelector('[data-aspect]').textContent = settings.aspectRatio ? String(Number(settings.aspectRatio.toFixed(3))) : 'Unavailable';
    root.querySelector('[data-rate]').textContent = settings.frameRate ? `${Number(settings.frameRate.toFixed(1))} fps` : 'Unavailable';
  };

  const end = (message = 'Camera stopped. Your video stream has been released.') => {
    requestToken += 1;
    const activeStream = stream;
    stream = null;
    stopStream(activeStream);
    preview.srcObject = null;
    setHidden(stop, true);
    setHidden(cancel, true);
    setHidden(deviceField, true);
    setHidden(mirrorField, true);
    setHidden(measurements, true);
    setHidden(placeholder, false);
    start.disabled = false;
    setStatus(root, message);
  };

  const listCameras = async (selectedId, token) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (destroyed || token !== requestToken) return false;
      fillDeviceSelect(select, devices.filter((device) => device.kind === 'videoinput'), selectedId, 'Camera');
      setHidden(deviceField, false);
      return true;
    } catch {
      if (destroyed || token !== requestToken) return false;
      setHidden(deviceField, true);
      return true;
    }
  };

  const begin = async (deviceId) => {
    if (stream) return;
    if (!hasMediaDevices()) {
      setStatus(root, 'Camera access is not available in this browser. Open this page over HTTPS in a current browser.', 'error');
      return;
    }
    const token = ++requestToken;
    const isCurrent = (candidate) => mediaToolHelpers.isCurrentSession(token, requestToken, stream, candidate, destroyed);
    start.disabled = true;
    setHidden(cancel, false);
    setStatus(root, 'Waiting for camera permission. You can cancel this request here.', 'pending');
    try {
      const candidate = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      });
      if (!mediaToolHelpers.isCurrentSession(token, requestToken, candidate, candidate, destroyed)) {
        stopStream(candidate);
        return;
      }
      stopStream(stream);
      stream = candidate;
      const track = candidate.getVideoTracks()[0];
      track?.addEventListener?.('ended', () => {
        if (isCurrent(candidate)) end('Camera stream ended. Check the camera connection, then try again.');
      }, { once: true });
      preview.srcObject = stream;
      await preview.play?.().catch(() => undefined);
      if (!isCurrent(candidate)) {
        stopStream(candidate);
        return;
      }
      const settings = candidate.getVideoTracks()[0]?.getSettings?.() || {};
      const listed = await listCameras(settings.deviceId, token);
      if (!listed || !isCurrent(candidate)) {
        stopStream(candidate);
        return;
      }
      renderSettings();
      setHidden(placeholder, true);
      setHidden(cancel, true);
      setHidden(stop, false);
      setHidden(mirrorField, false);
      setHidden(measurements, false);
      start.disabled = true;
      setStatus(root, 'Camera active. The measurements below are settings reported by your browser.', 'success');
    } catch (error) {
      if (destroyed || token !== requestToken) return;
      start.disabled = false;
      setHidden(cancel, true);
      setStatus(root, mediaToolHelpers.errorMessage(error, 'camera'), 'error');
    }
  };

  start.addEventListener('click', () => begin());
  cancel.addEventListener('click', () => end('Camera request cancelled. If the browser prompt is still open, you can dismiss it.'));
  stop.addEventListener('click', () => end());
  select.addEventListener('change', () => { const deviceId = select.value; end('Switching camera…'); begin(deviceId); });
  mirror.addEventListener('change', () => { preview.style.transform = mirror.checked ? 'scaleX(-1)' : 'none'; });
  preview.style.transform = 'scaleX(-1)';

  const unbind = bindLifecycle(() => end('Camera stopped because this page was hidden or left.'));
  return { destroy() { destroyed = true; unbind(); end('Camera stopped.'); } };
}

function mountMicrophone(root) {
  root.innerHTML = `
    <section class="tool-stage tool-stage-microphone" aria-label="Microphone test">
      <div class="meter-panel" aria-label="Live microphone level">
        <div class="meter-track" aria-hidden="true"><span class="meter-fill" data-meter></span></div>
        <p class="meter-reading" data-reading>—</p>
        <p class="sr-only" data-meter-text aria-live="off">No microphone input yet.</p>
      </div>
      <div class="tool-controls">
        <button class="button" type="button" data-start>Start microphone</button>
        <button class="button-secondary" type="button" data-cancel hidden>Cancel request</button>
        <button class="button-secondary" type="button" data-stop hidden>Stop microphone</button>
        <label class="field" data-device-field hidden>Microphone
          <select data-device aria-label="Choose microphone"></select>
        </label>
        <button class="button-small" type="button" data-record disabled>Record 15-second sample</button>
        <button class="button-small" type="button" data-record-stop hidden>Finish recording</button>
      </div>
      <p class="status" data-status role="status" aria-live="polite">Ready to start. Audio stays on this device.</p>
      <div class="measurement-grid" data-measurements hidden>
        <div class="measurement"><span>Input level</span><strong data-level>—</strong></div>
        <div class="measurement"><span>Sample-rate setting</span><strong data-rate>—</strong></div>
        <div class="measurement"><span>Channels</span><strong data-channels>—</strong></div>
      </div>
      <div data-recording-result hidden>
        <p class="help-note">Your recording is available only in this browser until you stop or reset this test.</p>
        <audio controls data-recording></audio>
      </div>
      <p class="help-note">The meter shows an approximate relative digital level (dBFS), not sound pressure in dB SPL and not an assessment of voice quality.</p>
    </section>`;

  const start = root.querySelector('[data-start]');
  const cancel = root.querySelector('[data-cancel]');
  const stop = root.querySelector('[data-stop]');
  const select = root.querySelector('[data-device]');
  const deviceField = root.querySelector('[data-device-field]');
  const record = root.querySelector('[data-record]');
  const recordStop = root.querySelector('[data-record-stop]');
  const result = root.querySelector('[data-recording-result]');
  const audio = root.querySelector('[data-recording]');
  const meter = root.querySelector('[data-meter]');
  const reading = root.querySelector('[data-reading]');
  const meterText = root.querySelector('[data-meter-text]');
  let stream = null;
  let context = null;
  let analyser = null;
  let animation = 0;
  let recorder = null;
  let recordingTimeout = 0;
  let recordingUrl = null;
  let requestToken = 0;
  let destroyed = false;

  const revokeRecording = () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = null;
    audio.removeAttribute('src');
    audio.load?.();
    setHidden(result, true);
  };

  const stopRecording = () => {
    globalThis.clearTimeout(recordingTimeout);
    if (recorder?.state === 'recording') recorder.stop();
    setHidden(recordStop, true);
    record.disabled = !stream || !globalThis.MediaRecorder;
  };

  const stopMeter = () => {
    globalThis.cancelAnimationFrame?.(animation);
    animation = 0;
    analyser?.disconnect?.();
    context?.close?.().catch?.(() => undefined);
    analyser = null;
    context = null;
    meter.style.width = '0%';
    reading.textContent = '—';
  };

  const drawMeter = () => {
    if (!analyser || !stream) return;
    const values = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(values);
    const dbfs = mediaToolHelpers.dbfs(mediaToolHelpers.rms(values));
    const progress = Math.max(0, Math.min(100, ((dbfs + 70) / 70) * 100));
    meter.style.width = `${progress}%`;
    const formatted = mediaToolHelpers.formatDbfs(dbfs);
    reading.textContent = formatted;
    meterText.textContent = `Microphone level ${formatted}.`;
    root.querySelector('[data-level]').textContent = formatted;
    animation = globalThis.requestAnimationFrame?.(drawMeter) || 0;
  };

  const end = (message = 'Microphone stopped. Audio input and the local sample have been released.') => {
    requestToken += 1;
    stopRecording();
    revokeRecording();
    stopMeter();
    const activeStream = stream;
    stream = null;
    stopStream(activeStream);
    recorder = null;
    setHidden(stop, true);
    setHidden(cancel, true);
    setHidden(deviceField, true);
    setHidden(root.querySelector('[data-measurements]'), true);
    start.disabled = false;
    record.disabled = true;
    setStatus(root, message);
  };

  const listMics = async (selectedId, token) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (destroyed || token !== requestToken) return false;
      fillDeviceSelect(select, devices.filter((device) => device.kind === 'audioinput'), selectedId, 'Microphone');
      setHidden(deviceField, false);
      return true;
    } catch {
      if (destroyed || token !== requestToken) return false;
      setHidden(deviceField, true);
      return true;
    }
  };

  const begin = async (deviceId) => {
    if (stream) return;
    if (!hasMediaDevices()) {
      setStatus(root, 'Microphone access is not available in this browser. Open this page over HTTPS in a current browser.', 'error');
      return;
    }
    const token = ++requestToken;
    const isCurrent = (candidate) => mediaToolHelpers.isCurrentSession(token, requestToken, stream, candidate, destroyed);
    start.disabled = true;
    setHidden(cancel, false);
    setStatus(root, 'Waiting for microphone permission. You can cancel this request here.', 'pending');
    try {
      const candidate = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false });
      if (!mediaToolHelpers.isCurrentSession(token, requestToken, candidate, candidate, destroyed)) {
        stopStream(candidate);
        return;
      }
      stopStream(stream);
      stream = candidate;
      const track = stream.getAudioTracks()[0];
      track?.addEventListener?.('ended', () => {
        if (isCurrent(candidate)) end('Microphone stream ended. Check the microphone connection, then try again.');
      }, { once: true });
      const settings = track?.getSettings?.() || {};
      const listed = await listMics(settings.deviceId, token);
      if (!listed || !isCurrent(candidate)) {
        stopStream(candidate);
        return;
      }
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      let meterAvailable = false;
      if (AudioContextClass) {
        let candidateContext = null;
        let candidateAnalyser = null;
        try {
          candidateContext = new AudioContextClass();
          context = candidateContext;
          await candidateContext.resume?.();
          if (!isCurrent(candidate)) {
            candidateContext.close?.().catch?.(() => undefined);
            stopStream(candidate);
            return;
          }
          candidateAnalyser = candidateContext.createAnalyser();
          candidateAnalyser.fftSize = 2048;
          candidateContext.createMediaStreamSource(candidate).connect(candidateAnalyser);
          if (!isCurrent(candidate)) {
            candidateAnalyser.disconnect?.();
            candidateContext.close?.().catch?.(() => undefined);
            stopStream(candidate);
            return;
          }
          context = candidateContext;
          analyser = candidateAnalyser;
          drawMeter();
          meterAvailable = true;
        } catch {
          candidateAnalyser?.disconnect?.();
          candidateContext?.close?.().catch?.(() => undefined);
          if (!isCurrent(candidate)) return;
          stopMeter();
        }
      }
      if (!isCurrent(candidate)) return;
      root.querySelector('[data-rate]').textContent = settings.sampleRate ? `${settings.sampleRate} Hz` : 'Unavailable';
      root.querySelector('[data-channels]').textContent = settings.channelCount || 'Unavailable';
      setHidden(root.querySelector('[data-measurements]'), false);
      setHidden(cancel, true);
      setHidden(stop, false);
      start.disabled = true;
      record.disabled = !globalThis.MediaRecorder;
      if (!globalThis.MediaRecorder) record.title = 'Recording is not supported in this browser.';
      setStatus(root, meterAvailable ? 'Microphone active. Speak normally to see relative input level.' : 'Microphone input is active, but this browser cannot show a live level meter.', meterAvailable ? 'success' : 'neutral');
    } catch (error) {
      if (destroyed || token !== requestToken) return;
      start.disabled = false;
      setHidden(cancel, true);
      setStatus(root, mediaToolHelpers.errorMessage(error, 'microphone'), 'error');
    }
  };

  const beginRecording = () => {
    if (!stream || !globalThis.MediaRecorder) return;
    revokeRecording();
    const recordingToken = requestToken;
    const localChunks = [];
    try {
      const activeRecorder = new MediaRecorder(stream);
      recorder = activeRecorder;
      activeRecorder.addEventListener('dataavailable', (event) => {
        if (recordingToken === requestToken && recorder === activeRecorder && event.data.size) localChunks.push(event.data);
      });
      activeRecorder.addEventListener('stop', () => {
        if (recordingToken !== requestToken || recorder !== activeRecorder || !localChunks.length || destroyed || !stream) return;
        recorder = null;
        recordingUrl = URL.createObjectURL(new Blob(localChunks, { type: activeRecorder.mimeType || 'audio/webm' }));
        audio.src = recordingUrl;
        setHidden(result, false);
        setStatus(root, 'Local recording ready to play. It will be removed when you stop or reset the microphone test.', 'success');
      }, { once: true });
      activeRecorder.start();
      record.disabled = true;
      setHidden(recordStop, false);
      setStatus(root, 'Recording a local sample. It stops automatically after 15 seconds.', 'pending');
      recordingTimeout = globalThis.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      setStatus(root, 'This browser could not start a local recording. The live microphone meter is still available.', 'error');
    }
  };

  start.addEventListener('click', () => begin());
  cancel.addEventListener('click', () => end('Microphone request cancelled. If the browser prompt is still open, you can dismiss it.'));
  stop.addEventListener('click', () => end());
  select.addEventListener('change', () => { const deviceId = select.value; end('Switching microphone…'); begin(deviceId); });
  record.addEventListener('click', beginRecording);
  recordStop.addEventListener('click', stopRecording);
  const unbind = bindLifecycle(() => end('Microphone stopped because this page was hidden or left.'));
  return { destroy() { destroyed = true; unbind(); end('Microphone stopped.'); } };
}

function mountHeadphones(root) {
  root.innerHTML = `
    <section class="tool-stage tool-stage-headphones" aria-label="Headphone channel test">
      <div class="channel-diagram" aria-hidden="true"><span>L</span><i></i><span>R</span></div>
      <div class="tool-controls channel-controls" aria-label="Choose an audio channel to play">
        <button class="button" type="button" data-channel="left">Play left</button>
        <button class="button" type="button" data-channel="both">Play both</button>
        <button class="button" type="button" data-channel="right">Play right</button>
        <button class="button-secondary" type="button" data-stop hidden>Stop sound</button>
      </div>
      <p class="status" data-status role="status" aria-live="polite">Choose a channel to play a short, gentle tone.</p>
      <div class="measurement-grid" aria-label="Your confirmations">
        <div class="measurement"><span>Left channel</span><strong data-confirm-left>Not confirmed</strong></div>
        <div class="measurement"><span>Right channel</span><strong data-confirm-right>Not confirmed</strong></div>
      </div>
      <div class="tool-controls confirmation-controls">
        <button class="button-small" type="button" data-confirm="left">I heard left</button>
        <button class="button-small" type="button" data-confirm="right">I heard right</button>
        <button class="button-small" type="button" data-reset>Reset confirmations</button>
      </div>
      <p class="help-note">Set a comfortable device volume first. Your confirmation records what you heard; browser playback alone cannot verify headphone condition.</p>
    </section>`;

  const stop = root.querySelector('[data-stop]');
  const diagram = root.querySelector('.channel-diagram');
  let context = null;
  let nodes = [];
  let endTimer = 0;
  let playbackToken = 0;
  let destroyed = false;

  const end = (message = 'Sound stopped.') => {
    playbackToken += 1;
    globalThis.clearTimeout(endTimer);
    nodes.forEach(({ gain, oscillator }) => {
      try { gain.gain.cancelScheduledValues(context?.currentTime || 0); gain.gain.setValueAtTime(0, context?.currentTime || 0); oscillator.stop(); } catch { /* already stopped */ }
    });
    nodes = [];
    context?.close?.().catch?.(() => undefined);
    context = null;
    diagram.removeAttribute('data-active');
    setHidden(stop, true);
    root.querySelectorAll('[data-channel]').forEach((button) => { button.disabled = false; });
    setStatus(root, message);
  };

  const addChannel = (targetContext, side) => {
    const oscillator = targetContext.createOscillator();
    const gain = targetContext.createGain();
    const merger = targetContext.createChannelMerger(2);
    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, targetContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, targetContext.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, targetContext.currentTime + 1.15);
    oscillator.connect(gain).connect(merger, 0, side === 'left' ? 0 : 1);
    merger.connect(targetContext.destination);
    oscillator.start();
    oscillator.stop(targetContext.currentTime + 1.2);
    nodes.push({ oscillator, gain });
  };

  const play = async (channel) => {
    if (destroyed) return;
    end('');
    const token = ++playbackToken;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) {
      setStatus(root, 'Audio playback is not available in this browser.', 'error');
      return;
    }
    try {
      const candidateContext = new AudioContextClass();
      context = candidateContext;
      setHidden(stop, false);
      root.querySelectorAll('[data-channel]').forEach((button) => { button.disabled = true; });
      setStatus(root, 'Preparing audio. Use Stop sound to cancel.', 'pending');
      await candidateContext.resume?.();
      if (destroyed || token !== playbackToken || context !== candidateContext) {
        candidateContext.close?.().catch?.(() => undefined);
        return;
      }
      if (channel === 'left' || channel === 'both') addChannel(candidateContext, 'left');
      if (channel === 'right' || channel === 'both') addChannel(candidateContext, 'right');
      diagram.dataset.active = channel;
      root.querySelectorAll('[data-channel]').forEach((button) => { button.disabled = true; });
      setHidden(stop, false);
      setStatus(root, `Playing ${channel === 'both' ? 'both channels' : `${channel} channel`} at a gentle level.`, 'pending');
      endTimer = globalThis.setTimeout(() => {
        if (!destroyed && token === playbackToken) end('Tone finished. Confirm what you heard below.');
      }, 1250);
    } catch {
      if (destroyed || token !== playbackToken) return;
      end('');
      setStatus(root, 'This browser could not start audio playback. Check your device volume and try again.', 'error');
    }
  };

  root.querySelectorAll('[data-channel]').forEach((button) => button.addEventListener('click', () => play(button.dataset.channel)));
  stop.addEventListener('click', () => end('Sound stopped.'));
  root.querySelector('[data-reset]').addEventListener('click', () => {
    end('Confirmations cleared. Play a channel to begin again.');
    root.querySelector('[data-confirm-left]').textContent = 'Not confirmed';
    root.querySelector('[data-confirm-right]').textContent = 'Not confirmed';
  });
  root.querySelectorAll('[data-confirm]').forEach((button) => button.addEventListener('click', () => {
    const channel = button.dataset.confirm;
    root.querySelector(`[data-confirm-${channel}]`).textContent = 'You confirmed this';
    setStatus(root, `You confirmed that you heard the ${channel} channel.`, 'success');
  }));
  const unbind = bindLifecycle(() => end('Sound stopped because this page was hidden or left.'));
  return { destroy() { destroyed = true; unbind(); end('Sound stopped.'); } };
}
