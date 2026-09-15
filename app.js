/**
 * Simple M3U8 Player
 * Powered by Hls.js with native HLS fallback (Safari/iOS)
 */

(function () {
  'use strict';

  // State
  let hls = null;
  let statsInterval = null;
  const STORAGE_KEY = 'm3u8_player_history';
  const DEFAULT_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

  // DOM Elements
  const video = document.getElementById('video');
  const videoContainer = document.getElementById('videoContainer');
  const streamForm = document.getElementById('streamForm');
  const streamUrlInput = document.getElementById('streamUrl');
  const loadBtn = document.getElementById('loadBtn');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const videoSpinner = document.getElementById('videoSpinner');
  const streamBadge = document.getElementById('streamBadge');
  const engineBadge = document.getElementById('engineBadge');

  // Controls
  const qualitySelect = document.getElementById('qualitySelect');
  const audioSelect = document.getElementById('audioSelect');
  const speedSelect = document.getElementById('speedSelect');
  const pipBtn = document.getElementById('pipBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  // Stats
  const streamTypeTag = document.getElementById('streamTypeTag');
  const statResolution = document.getElementById('statResolution');
  const statBitrate = document.getElementById('statBitrate');
  const statBuffer = document.getElementById('statBuffer');
  const statDropped = document.getElementById('statDropped');

  // Alert
  const alertBox = document.getElementById('alertBox');
  const alertTitle = document.getElementById('alertTitle');
  const alertMsg = document.getElementById('alertMsg');
  const dismissAlert = document.getElementById('dismissAlert');

  // History & Presets
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const presetChips = document.querySelectorAll('.chip');

  /**
   * Determine HLS engine support
   */
  const hlsSupported = typeof window.Hls !== 'undefined' && Hls.isSupported();
  const nativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl');

  function initEngineBadge() {
    if (hlsSupported) {
      engineBadge.textContent = 'HLS.js Engine';
      engineBadge.classList.add('active');
    } else if (nativeHlsSupported) {
      engineBadge.textContent = 'Native HLS (Safari)';
      engineBadge.classList.add('active');
    } else {
      engineBadge.textContent = 'HLS Not Supported';
      engineBadge.style.color = 'var(--danger)';
      showAlert('Browser Incompatible', 'Your browser does not support HLS playback (Hls.js or Native HLS).');
    }
  }

  /**
   * Alert helper
   */
  function showAlert(title, message) {
    alertTitle.textContent = title;
    alertMsg.innerHTML = message;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }

  dismissAlert.addEventListener('click', hideAlert);

  /**
   * Spinner helper
   */
  function showSpinner(show) {
    if (show) {
      videoSpinner.classList.remove('hidden');
    } else {
      videoSpinner.classList.add('hidden');
    }
  }

  /**
   * Format bitrate (bps to kbps/Mbps)
   */
  function formatBitrate(bps) {
    if (!bps || isNaN(bps) || bps <= 0) return '--';
    if (bps >= 1000000) {
      return (bps / 1000000).toFixed(2) + ' Mbps';
    }
    return Math.round(bps / 1000) + ' kbps';
  }

  /**
   * Clean up existing stream playback
   */
  function cleanup() {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }

    if (hls) {
      hls.destroy();
      hls = null;
    }

    video.pause();
    video.removeAttribute('src');
    video.load();

    // Reset controls
    qualitySelect.innerHTML = '<option value="-1">Auto</option>';
    qualitySelect.disabled = true;
    audioSelect.innerHTML = '<option value="-1">Default</option>';
    audioSelect.disabled = true;

    // Reset stats
    statResolution.textContent = '--';
    statBitrate.textContent = '--';
    statBuffer.textContent = '--';
    statDropped.textContent = '0';
    streamTypeTag.textContent = 'No stream loaded';
    streamTypeTag.className = 'status-tag';
    streamBadge.classList.add('hidden');
  }

  /**
   * Start updating real-time playback diagnostics
   */
  function startStatsMonitor() {
    if (statsInterval) clearInterval(statsInterval);

    statsInterval = setInterval(() => {
      // Resolution
      if (video.videoWidth && video.videoHeight) {
        statResolution.textContent = `${video.videoWidth} × ${video.videoHeight}`;
      } else {
        statResolution.textContent = '--';
      }

      // Bitrate
      if (hls && hls.levels && hls.currentLevel >= 0) {
        const currentLvl = hls.levels[hls.currentLevel];
        if (currentLvl && currentLvl.bitrate) {
          statBitrate.textContent = formatBitrate(currentLvl.bitrate);
        }
      } else if (hls && hls.bandwidthEstimate) {
        statBitrate.textContent = `~${formatBitrate(hls.bandwidthEstimate)}`;
      }

      // Buffer ahead calculation
      let bufferAhead = 0;
      if (video.buffered && video.buffered.length > 0) {
        const currentTime = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
          const start = video.buffered.start(i);
          const end = video.buffered.end(i);
          if (currentTime >= start && currentTime <= end) {
            bufferAhead = end - currentTime;
            break;
          }
        }
        statBuffer.textContent = `${bufferAhead.toFixed(1)}s`;
      } else {
        statBuffer.textContent = '--';
      }

      // Dropped frames
      if (typeof video.getVideoPlaybackQuality === 'function') {
        const quality = video.getVideoPlaybackQuality();
        statDropped.textContent = quality.droppedVideoFrames || 0;
      }

      // Live vs VOD determination
      const isLive = video.duration === Infinity || (hls && hls.levels && hls.levels[0]?.details?.live);
      if (isLive) {
        streamTypeTag.textContent = 'LIVE STREAM';
        streamTypeTag.className = 'status-tag live';
        streamBadge.classList.remove('hidden');
      } else if (video.duration > 0) {
        const mins = Math.floor(video.duration / 60);
        const secs = Math.floor(video.duration % 60);
        streamTypeTag.textContent = `VOD (${mins}:${secs.toString().padStart(2, '0')})`;
        streamTypeTag.className = 'status-tag vod';
        streamBadge.classList.add('hidden');
      }
    }, 800);
  }

  /**
   * Load and play an M3U8 URL
   */
  function loadStream(url) {
    if (!url) return;
    url = url.trim();

    hideAlert();
    cleanup();
    showSpinner(true);

    streamUrlInput.value = url;
    saveToHistory(url);

    if (hlsSupported) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        capLevelToPlayerSize: false,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        // Media attached
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        showSpinner(false);
        populateQualityLevels(data.levels);
        populateAudioTracks(hls.audioTracks);

        video.play().catch((err) => {
          console.warn('Autoplay prevented:', err);
          showAlert('Autoplay Blocked', 'Click the play button to start video playback (browser policy).');
        });

        startStatsMonitor();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const levelIndex = data.level;
        if (hls.levels && hls.levels[levelIndex]) {
          const lvl = hls.levels[levelIndex];
          const qualityName = lvl.height ? `${lvl.height}p` : `Level ${levelIndex}`;
          if (qualitySelect.value === '-1') {
            qualitySelect.options[0].text = `Auto (${qualityName})`;
          }
        }
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        if (audioSelect) {
          audioSelect.value = data.id;
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error Event:', data);
        if (data.fatal) {
          showSpinner(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Likely CORS or 404
              showAlert(
                'Network / CORS Error',
                `Failed to load stream. Ensure the URL is accessible and the server allows CORS (<code>Access-Control-Allow-Origin</code>). Details: ${data.details}`
              );
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              showAlert('Media Playback Error', `Corrupted or unsupported media segment encountered: ${data.details}. Attempting recovery...`);
              hls.recoverMediaError();
              break;
            default:
              showAlert('Fatal Stream Error', `Playback cannot continue. Details: ${data.details}`);
              hls.destroy();
              break;
          }
        }
      });
    } else if (nativeHlsSupported) {
      // Native Apple HLS (Safari/iOS)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        showSpinner(false);
        video.play().catch((err) => {
          console.warn('Autoplay blocked:', err);
        });
        startStatsMonitor();
      }, { once: true });

      video.addEventListener('error', () => {
        showSpinner(false);
        showAlert('Native Playback Error', 'Safari/Browser failed to decode this HLS stream or encountered a network error.');
      }, { once: true });
    } else {
      showSpinner(false);
      showAlert('Unsupported', 'HLS playback is not supported on this browser.');
    }
  }

  /**
   * Populate Quality Selector from HLS levels
   */
  function populateQualityLevels(levels) {
    qualitySelect.innerHTML = '<option value="-1">Auto</option>';
    if (!levels || levels.length <= 1) {
      qualitySelect.disabled = true;
      return;
    }

    qualitySelect.disabled = false;
    levels.forEach((level, index) => {
      const option = document.createElement('option');
      option.value = index;
      const height = level.height ? `${level.height}p` : `Stream ${index + 1}`;
      const bitrate = level.bitrate ? ` (${Math.round(level.bitrate / 1000)} kbps)` : '';
      option.textContent = `${height}${bitrate}`;
      qualitySelect.appendChild(option);
    });
  }

  /**
   * Populate Audio Track Selector
   */
  function populateAudioTracks(tracks) {
    audioSelect.innerHTML = '<option value="-1">Default</option>';
    if (!tracks || tracks.length <= 1) {
      audioSelect.disabled = true;
      return;
    }

    audioSelect.disabled = false;
    tracks.forEach((track) => {
      const option = document.createElement('option');
      option.value = track.id;
      option.textContent = track.name || track.lang || `Track ${track.id}`;
      audioSelect.appendChild(option);
    });
  }

  // Quality Change
  qualitySelect.addEventListener('change', (e) => {
    if (!hls) return;
    const levelIndex = parseInt(e.target.value, 10);
    hls.currentLevel = levelIndex;
    if (levelIndex === -1) {
      qualitySelect.options[0].text = 'Auto';
    }
  });

  // Audio Track Change
  audioSelect.addEventListener('change', (e) => {
    if (!hls) return;
    const trackId = parseInt(e.target.value, 10);
    if (trackId >= 0) {
      hls.audioTrack = trackId;
    }
  });

  // Playback Rate
  speedSelect.addEventListener('change', (e) => {
    video.playbackRate = parseFloat(e.target.value);
  });

  // Video State Listeners for Spinner
  video.addEventListener('waiting', () => showSpinner(true));
  video.addEventListener('playing', () => showSpinner(false));
  video.addEventListener('canplay', () => showSpinner(false));

  // Picture in Picture
  pipBtn.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && video.readyState >= 1) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed:', err);
    }
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  // Clear Input Button
  clearInputBtn.addEventListener('click', () => {
    streamUrlInput.value = '';
    streamUrlInput.focus();
  });

  // Stream Form Submit
  streamForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = streamUrlInput.value.trim();
    if (url) {
      loadStream(url);
    }
  });

  // Preset chips click
  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-url');
      if (url) {
        loadStream(url);
      }
    });
  });

  /**
   * LocalStorage History
   */
  function getHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToHistory(url) {
    if (!url) return;
    try {
      let history = getHistory().filter((item) => item !== url);
      history.unshift(url);
      if (history.length > 8) history = history.slice(0, 8);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      renderHistory();
    } catch (e) {
      console.warn('Could not save history:', e);
    }
  }

  function deleteHistoryItem(index) {
    const history = getHistory();
    history.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderHistory();
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  }

  clearHistoryBtn.addEventListener('click', clearHistory);

  function renderHistory() {
    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<li class="history-empty">No recently played streams</li>';
      return;
    }

    history.forEach((url, idx) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const span = document.createElement('span');
      span.className = 'history-item-url';
      span.textContent = url;
      span.title = url;
      span.addEventListener('click', () => loadStream(url));

      const delBtn = document.createElement('button');
      delBtn.className = 'history-item-del';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Remove from history';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(idx);
      });

      li.appendChild(span);
      li.appendChild(delBtn);
      historyList.appendChild(li);
    });
  }

  /**
   * Keyboard Shortcuts
   */
  window.addEventListener('keydown', (e) => {
    // Ignore if typing inside input
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        video.muted = !video.muted;
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        if (!document.fullscreenElement) {
          if (videoContainer.requestFullscreen) videoContainer.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
        break;
    }
  });

  // Init
  initEngineBadge();
  renderHistory();

  // Load default demo stream on start
  streamUrlInput.value = DEFAULT_STREAM;
  loadStream(DEFAULT_STREAM);
})();
