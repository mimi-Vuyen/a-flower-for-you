const gift = document.querySelector(".gift");
const button = document.querySelector(".action-button");
const caption = document.querySelector(".garden__caption");
const message = document.querySelector(".message");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const audioToggle = document.querySelector(".audio-toggle");
const backgroundAudio = document.querySelector(".background-audio");
const audioStatus = document.querySelector(".audio-status");

const stages = ["seed", "sprout", "leaves", "bud", "bloom", "completed"];
const stageDurations = {
  seed: 1500,
  sprout: 2000,
  leaves: 2000,
  bud: 1500,
  bloom: 2000,
};
const stageCaptions = {
  idle: "Chạm nhẹ để gieo một điều dịu dàng",
  seed: "Hạt giống khẽ rung, bắt đầu thức giấc…",
  sprout: "Mầm xanh nhú lên, thân cây vươn mình…",
  leaves: "Chiếc lá đầu tiên mở ra… chiếc lá thứ hai nối theo…",
  bud: "Một nụ hoa nhỏ đang thành hình…",
  bloom: "Những cánh hoa hồng khẽ mở…",
  completed: "Một điều dịu dàng đã nở hoa",
};

let currentState = "idle";
let stageTimer = null;
let runId = 0;
let audioEnabled = false;
let userMutedAudio = false;
let audioPlayId = 0;
let audioFadeFrame = null;
let audioFadeId = 0;
let audioPlayPending = false;
let audioFailed = false;
let audioDesired = false;
let audioBlocked = false;

backgroundAudio.volume = 0;

function announceAudioStatus(text) {
  audioStatus.textContent = text;
}

function stopAudioFade() {
  if (audioFadeFrame !== null) {
    window.cancelAnimationFrame(audioFadeFrame);
    audioFadeFrame = null;
  }
}

function fadeAudioTo(targetVolume, duration, onComplete) {
  stopAudioFade();
  const fadeId = ++audioFadeId;
  const startVolume = backgroundAudio.volume;
  const startTime = performance.now();

  function updateVolume(now) {
    if (fadeId !== audioFadeId) return;

    const progress = Math.max(0, Math.min((now - startTime) / duration, 1));
    backgroundAudio.volume = Math.max(
      0,
      Math.min(startVolume + (targetVolume - startVolume) * progress, 1),
    );

    if (progress < 1) {
      audioFadeFrame = window.requestAnimationFrame(updateVolume);
    } else {
      audioFadeFrame = null;
      if (onComplete) onComplete();
    }
  }

  audioFadeFrame = window.requestAnimationFrame(updateVolume);
}

function reportAudioPlaybackFailure(error) {
  if (error.name === "NotAllowedError") {
    ++audioPlayId;
    audioPlayPending = false;
    audioDesired = false;
    audioBlocked = true;
    audioEnabled = !backgroundAudio.paused;
    updateAudioControl();
    announceAudioStatus(
      "Tự động phát nhạc bị chặn. Nhấn thử trồng hoa hoặc nút loa để bật nhạc.",
    );
    return;
  }

  ++audioPlayId;
  audioPlayPending = false;
  audioFailed = true;
  audioEnabled = false;
  audioDesired = false;
  updateAudioControl();
  stopAudioFade();
  backgroundAudio.pause();
  backgroundAudio.volume = 0;

  if (backgroundAudio.error?.code === 4) {
    announceAudioStatus(
      "Không thể đọc assets/music/bloom.mp3. Hãy kiểm tra tệp có tồn tại và đúng định dạng MP3.",
    );
  } else if (backgroundAudio.error) {
    announceAudioStatus("Không tải được assets/music/bloom.mp3. Hãy kiểm tra kết nối và tệp nhạc.");
  } else {
    announceAudioStatus("Không thể phát nhạc. Hãy kiểm tra file assets/music/bloom.mp3.");
  }
}

function startMusic(userInitiated = false) {
  if (userInitiated) {
    userMutedAudio = false;
    audioFailed = false;
    audioBlocked = false;
  }

  if (userMutedAudio || (audioFailed && !userInitiated)) return;
  audioDesired = true;

  if (!backgroundAudio.paused) {
    audioEnabled = true;
    updateAudioControl();
    announceAudioStatus("Cherry Blossom Love — 薄紅の恋 đang phát.");
    return;
  }

  if (audioPlayPending) {
    if (!userInitiated) return;
    ++audioPlayId;
    audioPlayPending = false;
  }

  const playId = ++audioPlayId;
  audioPlayPending = true;
  updateAudioControl();
  announceAudioStatus("Đang tải nhạc nền…");
  stopAudioFade();
  backgroundAudio.volume = 0;
  let playRequest;
  try {
    playRequest = backgroundAudio.play();
  } catch (error) {
    audioPlayPending = false;
    reportAudioPlaybackFailure(error);
    return;
  }

  if (!playRequest) {
    audioPlayPending = false;
    reportAudioPlaybackFailure(new Error("Audio playback is not supported."));
    return;
  }

  playRequest
    .then(() => {
      if (playId !== audioPlayId) {
        if (!audioDesired || userMutedAudio) {
          backgroundAudio.volume = 0;
          backgroundAudio.pause();
        }
        return;
      }

      audioPlayPending = false;
      if (userMutedAudio || !audioDesired) {
        backgroundAudio.volume = 0;
        backgroundAudio.pause();
        return;
      }

      audioFailed = false;
      audioBlocked = false;
      audioEnabled = !backgroundAudio.paused;
      updateAudioControl();
      announceAudioStatus("Cherry Blossom Love — 薄紅の恋 đang phát.");
      fadeAudioTo(0.25, 2000);
    })
    .catch((error) => {
      if (playId !== audioPlayId) return;
      audioPlayPending = false;
      if (userMutedAudio) return;
      reportAudioPlaybackFailure(error);
    });
}

function updateAudioControl() {
  audioEnabled = !backgroundAudio.paused;
  audioToggle.setAttribute("aria-pressed", String(audioEnabled));
  audioToggle.setAttribute("aria-label", audioEnabled ? "Tắt nhạc nền" : "Bật nhạc nền");
}

function toggleMusic() {
  if (backgroundAudio.paused) {
    startMusic(true);
    return;
  }

  userMutedAudio = true;
  audioEnabled = false;
  audioDesired = false;
  audioPlayPending = false;
  ++audioPlayId;
  updateAudioControl();
  announceAudioStatus("Nhạc nền đã tắt.");

  const pauseAfterFadeId = audioPlayId;
  fadeAudioTo(0, 350, () => {
    if (pauseAfterFadeId !== audioPlayId || audioDesired) return;
    backgroundAudio.pause();
  });
}

backgroundAudio.addEventListener("playing", () => {
  updateAudioControl();
});
backgroundAudio.addEventListener("pause", () => {
  updateAudioControl();
});

function setState(nextState) {
  currentState = nextState;
  gift.dataset.state = nextState;
  caption.textContent = stageCaptions[nextState];
  message.hidden = nextState !== "completed";
  button.disabled = nextState !== "idle" && nextState !== "completed";
}

function waitForPaint() {
  return new Promise((resolve) => {
    let settled = false;
    let frameId;
    const fallbackId = window.setTimeout(finish, 100);

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackId);
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      resolve();
    }

    window.requestAnimationFrame(() => {
      if (!settled) frameId = window.requestAnimationFrame(finish);
    });
  });
}

async function startGrowth() {
  if (currentState !== "idle" && currentState !== "completed") return;

  if (!userMutedAudio && !audioFailed) {
    startMusic(audioBlocked || !audioDesired);
  }
  const activeRunId = ++runId;
  window.clearTimeout(stageTimer);
  stageTimer = null;
  button.disabled = true;
  gift.dataset.started = "true";
  gift.dataset.resetting = "true";
  gift.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());

  setState("idle");
  button.disabled = true;
  void gift.offsetWidth;
  await waitForPaint();

  if (activeRunId !== runId) return;

  delete gift.dataset.resetting;
  void gift.offsetWidth;

  if (reducedMotion.matches) {
    setState("completed");
    return;
  }

  function advanceTo(index) {
    if (activeRunId !== runId) return;

    const nextState = stages[index];
    setState(nextState);

    if (nextState === "completed") return;

    stageTimer = window.setTimeout(() => {
      stageTimer = null;
      advanceTo(index + 1);
    }, stageDurations[nextState]);
  }

  advanceTo(0);
}

button.addEventListener("click", startGrowth);
audioToggle.addEventListener("click", toggleMusic);
backgroundAudio.addEventListener("error", () => {
  reportAudioPlaybackFailure(new Error("Audio file failed to load."));
});

updateAudioControl();
startMusic();
