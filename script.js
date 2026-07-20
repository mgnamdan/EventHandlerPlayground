const lobby = document.querySelector("#lobby");
const gameGrid = document.querySelector("#gameGrid");
const arena = document.querySelector("#arena");
const gameTitle = document.querySelector("#gameTitle");
const gameLesson = document.querySelector("#gameLesson");
const gamePrompt = document.querySelector("#gamePrompt");
const gameScore = document.querySelector("#gameScore");
const gameStage = document.querySelector("#gameStage");
const backButton = document.querySelector("#backButton");
const restartButton = document.querySelector("#restartButton");

let activeGameId = null;
let cleanupActiveGame = () => {};

const games = [
  {
    id: "ghost-trace",
    title: "Ghost Trace",
    lesson: "Pointer events and path scoring",
    thumb: "thumb-trace",
    color: "#ffdfeb",
    tilt: "-1.5deg",
    description: "Study the shape, press down, then trace it from memory.",
    init: initGhostTrace
  },
  {
    id: "maze-delivery",
    title: "Maze Delivery",
    lesson: "Pointer movement and collision zones",
    thumb: "thumb-maze",
    color: "#dffbff",
    tilt: "1deg",
    description: "Pilot the package through the maze without touching a wall.",
    init: initMazeDelivery
  },
  {
    id: "panic-button",
    title: "Panic Button",
    lesson: "Clicks, double-clicks, targets, classes",
    thumb: "thumb-button",
    color: "#e7ffd8",
    tilt: "-2deg",
    description: "The correct button is being deeply unhelpful.",
    init: initPanicButton
  },
  {
    id: "keyboard-goblin",
    title: "Keyboard Goblin",
    lesson: "keydown, keyup, active key state",
    thumb: "thumb-keys",
    color: "#fff0b8",
    tilt: "1.4deg",
    description: "Follow fast keyboard orders where holding and releasing matter.",
    init: initKeyboardGoblin
  },
  {
    id: "slider-safecracker",
    title: "Slider Safecracker",
    lesson: "input events and live numeric feedback",
    thumb: "thumb-slider",
    color: "#e6deff",
    tilt: "-0.5deg",
    description: "Tune pitch, pressure, and sparkle until the vault gives up.",
    init: initSliderSafecracker
  },
  {
    id: "do-not-hover",
    title: "Do Not Hover",
    lesson: "mouseenter, mouseleave, event timing",
    thumb: "thumb-hover",
    color: "#ffe1bc",
    tilt: "2deg",
    description: "Click the prize while the traps overreact to your cursor.",
    init: initDoNotHover
  },
  {
    id: "wheel-runaway",
    title: "Wheel Runaway",
    lesson: "wheel events and rate control",
    thumb: "thumb-wheel",
    color: "#d9fff9",
    tilt: "-1deg",
    description: "Scroll to run, but do not fry your energy bar.",
    init: initWheelRunaway
  },
  {
    id: "drag-lab",
    title: "Drag Lab",
    lesson: "dragstart, dragover, drop, dataTransfer",
    thumb: "thumb-drag",
    color: "#ffe4f1",
    tilt: "1.6deg",
    description: "Drag odd objects into the bins that actually understand them.",
    init: initDragLab
  }
];

renderLobby();

backButton.addEventListener("click", showLobby);
restartButton.addEventListener("click", () => {
  if (activeGameId) {
    startGame(activeGameId);
  }
});

function renderLobby() {
  gameGrid.innerHTML = "";

  games.forEach((game) => {
    const card = document.createElement("button");
    card.className = "game-card";
    card.type = "button";
    card.style.setProperty("--card-color", game.color);
    card.style.setProperty("--tilt", game.tilt);
    card.innerHTML = `
      <div class="thumbnail ${game.thumb}" aria-hidden="true"></div>
      <h3>${game.title}</h3>
      <p>${game.description}</p>
      <span class="lesson-chip">${game.lesson}</span>
    `;
    card.addEventListener("click", () => startGame(game.id));
    gameGrid.append(card);
  });
}

function startGame(gameId) {
  const game = games.find((item) => item.id === gameId);
  if (!game) return;

  cleanupActiveGame();
  cleanupActiveGame = () => {};
  activeGameId = gameId;

  lobby.hidden = true;
  arena.hidden = false;
  gameStage.innerHTML = "";
  gameTitle.textContent = game.title;
  gameLesson.textContent = game.lesson;
  setPrompt(game.description);
  setScore("Ready");

  cleanupActiveGame = game.init();
}

function showLobby() {
  cleanupActiveGame();
  cleanupActiveGame = () => {};
  activeGameId = null;
  arena.hidden = true;
  lobby.hidden = false;
  gameStage.innerHTML = "";
}

function setPrompt(message) {
  gamePrompt.textContent = message;
}

function setScore(message) {
  gameScore.textContent = message;
}

function clearTimers(timerIds) {
  timerIds.forEach((timerId) => clearTimeout(timerId));
}

function clearIntervals(intervalIds) {
  intervalIds.forEach((intervalId) => clearInterval(intervalId));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pointFromEvent(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

// Game 1: Pointer events make it possible to capture a hand-drawn path.
function initGhostTrace() {
  const timers = [];
  const shapePaths = [
    "M100 390 L190 105 L275 390 L50 215 L325 215 Z",
    "M90 330 C180 90 375 90 455 250 C520 380 370 445 260 350 C185 286 295 170 380 245",
    "M70 120 L160 260 L230 130 L310 330 L410 145 L515 360",
    "M330 55 L180 250 L285 250 L210 430 L430 190 L312 190 Z"
  ];
  const chosenPath = shapePaths[randomBetween(0, shapePaths.length - 1)];
  let canDraw = false;
  let drawing = false;
  let playerPoints = [];
  let guideSamples = [];

  gameStage.innerHTML = `
    <div class="trace-board playfield">
      <svg class="trace-svg" viewBox="0 0 600 480" role="img" aria-label="Memory tracing board">
        <path id="traceGuide" class="trace-guide" d="${chosenPath}"></path>
        <path id="tracePlayer" class="trace-player rough" d=""></path>
      </svg>
      <div id="traceCountdown" class="countdown-badge">3</div>
    </div>
  `;

  const board = gameStage.querySelector(".trace-board");
  const svg = gameStage.querySelector(".trace-svg");
  const guide = gameStage.querySelector("#traceGuide");
  const player = gameStage.querySelector("#tracePlayer");
  const countdown = gameStage.querySelector("#traceCountdown");
  const totalLength = guide.getTotalLength();

  guideSamples = Array.from({ length: 80 }, (_, index) => {
    const point = guide.getPointAtLength((index / 79) * totalLength);
    return { x: point.x, y: point.y };
  });

  setPrompt("Memorize the shape. The guide disappears when the countdown ends or when you press down.");
  let remaining = 3;
  const countdownTimer = setInterval(() => {
    remaining -= 1;
    countdown.textContent = String(remaining);
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      beginChallenge();
    }
  }, 1000);

  function beginChallenge() {
    canDraw = true;
    guide.style.opacity = "0";
    countdown.textContent = "Go";
    setPrompt("Press and hold, trace once, then release. One shot.");
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function drawPath() {
    if (playerPoints.length === 0) {
      player.setAttribute("d", "");
      return;
    }
    const [first, ...rest] = playerPoints;
    const d = [`M${first.x.toFixed(1)} ${first.y.toFixed(1)}`]
      .concat(rest.map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`))
      .join(" ");
    player.setAttribute("d", d);
  }

  function scoreTrace() {
    if (playerPoints.length < 8) {
      setScore("0%");
      setPrompt("Too short. The shape barely had time to become a rumor.");
      return;
    }

    const averageDistance = guideSamples.reduce((sum, guidePoint) => {
      const nearest = playerPoints.reduce((best, playerPoint) => {
        const distance = Math.hypot(guidePoint.x - playerPoint.x, guidePoint.y - playerPoint.y);
        return Math.min(best, distance);
      }, Infinity);
      return sum + nearest;
    }, 0) / guideSamples.length;

    const score = clamp(Math.round(100 - averageDistance * 1.5), 0, 100);
    setScore(`${score}%`);
    setPrompt(score > 78 ? "Spectral masterpiece." : score > 45 ? "Recognizable, with artistic panic." : "Boldly unrelated to the original.");
  }

  function handlePointerDown(event) {
    if (!canDraw) {
      clearInterval(countdownTimer);
      beginChallenge();
    }
    if (drawing || playerPoints.length > 0) return;

    drawing = true;
    board.setPointerCapture(event.pointerId);
    playerPoints = [svgPoint(event)];
    drawPath();
  }

  function handlePointerMove(event) {
    if (!drawing) return;
    playerPoints.push(svgPoint(event));
    drawPath();
  }

  function handlePointerUp(event) {
    if (!drawing) return;
    drawing = false;
    board.releasePointerCapture(event.pointerId);
    scoreTrace();
  }

  board.addEventListener("pointerdown", handlePointerDown);
  board.addEventListener("pointermove", handlePointerMove);
  board.addEventListener("pointerup", handlePointerUp);
  board.addEventListener("pointercancel", handlePointerUp);

  timers.push(setTimeout(beginChallenge, 3100));

  return () => {
    clearInterval(countdownTimer);
    clearTimers(timers);
    board.removeEventListener("pointerdown", handlePointerDown);
    board.removeEventListener("pointermove", handlePointerMove);
    board.removeEventListener("pointerup", handlePointerUp);
    board.removeEventListener("pointercancel", handlePointerUp);
  };
}

// Game 2: Pointer movement plus DOM rectangles creates a simple collision game.
function initMazeDelivery() {
  let active = true;
  const timers = [];

  gameStage.innerHTML = `
    <div class="playfield">
      <div class="maze-board">
        <div class="maze-wall" style="left: 17%; top: 0; width: 9%; height: 72%;"></div>
        <div class="maze-wall" style="left: 36%; top: 28%; width: 9%; height: 72%;"></div>
        <div class="maze-wall" style="left: 55%; top: 0; width: 9%; height: 65%;"></div>
        <div class="maze-wall" style="left: 74%; top: 35%; width: 9%; height: 65%;"></div>
        <div class="maze-wall" style="left: 20%; top: 72%; width: 30%; height: 8%;"></div>
        <div class="maze-wall" style="left: 58%; top: 22%; width: 27%; height: 8%;"></div>
        <div class="maze-courier" id="mazeCourier" style="left: 8%; top: 88%;"></div>
        <div class="maze-goal" id="mazeGoal" aria-label="Delivery goal"></div>
      </div>
    </div>
  `;

  const board = gameStage.querySelector(".maze-board");
  const courier = gameStage.querySelector("#mazeCourier");
  const walls = Array.from(gameStage.querySelectorAll(".maze-wall"));
  const goal = gameStage.querySelector("#mazeGoal");

  setPrompt("Move inside the board. Hit a red wall and the delivery becomes confetti.");
  setScore("0 hits");
  let hits = 0;

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function resetCourier() {
    active = true;
    courier.style.left = "8%";
    courier.style.top = "88%";
  }

  function explode(x, y) {
    active = false;
    hits += 1;
    setScore(`${hits} hits`);
    setPrompt("Boom. The package will bravely try again.");
    const boom = document.createElement("div");
    boom.className = "boom";
    boom.style.left = `${x}px`;
    boom.style.top = `${y}px`;
    boom.textContent = "BANG";
    gameStage.querySelector(".playfield").append(boom);
    timers.push(setTimeout(() => {
      boom.remove();
      resetCourier();
      setPrompt("Move inside the board. Hit a red wall and the delivery becomes confetti.");
    }, 850));
  }

  function handlePointerMove(event) {
    if (!active) return;
    const boardRect = board.getBoundingClientRect();
    const x = clamp(event.clientX - boardRect.left, 19, boardRect.width - 19);
    const y = clamp(event.clientY - boardRect.top, 19, boardRect.height - 19);
    courier.style.left = `${x}px`;
    courier.style.top = `${y}px`;

    const courierRect = courier.getBoundingClientRect();
    const wallHit = walls.some((wall) => rectsOverlap(courierRect, wall.getBoundingClientRect()));
    if (wallHit) {
      explode(event.clientX - gameStage.getBoundingClientRect().left, event.clientY - gameStage.getBoundingClientRect().top);
      return;
    }

    if (rectsOverlap(courierRect, goal.getBoundingClientRect())) {
      active = false;
      setScore("Delivered");
      setPrompt("Package delivered. The maze is furious about it.");
    }
  }

  board.addEventListener("pointermove", handlePointerMove);

  return () => {
    clearTimers(timers);
    board.removeEventListener("pointermove", handlePointerMove);
  };
}

// Game 3: The event target tells us which button was clicked, even while the buttons move.
function initPanicButton() {
  const intervalIds = [];
  const labels = ["Green", "Bean", "Greeen", "Do not", "Maybe", "Double"];
  let targetIndex = randomBetween(0, 5);
  let wins = 0;

  gameStage.innerHTML = `<div class="panic-field playfield"></div>`;
  const field = gameStage.querySelector(".panic-field");

  setPrompt("Press the green button. The exact green button. Probably.");
  setScore("0/3");

  labels.forEach((label, index) => {
    const button = document.createElement("button");
    button.className = `panic-button ${index === targetIndex ? "green" : "decoy"}`;
    button.type = "button";
    button.dataset.index = String(index);
    button.textContent = index === 5 ? "Double" : label;
    field.append(button);
  });

  const buttons = Array.from(field.querySelectorAll(".panic-button"));

  function scatterButtons() {
    const fieldRect = field.getBoundingClientRect();
    buttons.forEach((button) => {
      const width = randomBetween(82, 154);
      const height = randomBetween(52, 88);
      button.style.width = `${width}px`;
      button.style.height = `${height}px`;
      button.style.left = `${randomBetween(10, Math.max(10, fieldRect.width - width - 12))}px`;
      button.style.top = `${randomBetween(10, Math.max(10, fieldRect.height - height - 12))}px`;
    });
  }

  function chooseNewTarget() {
    targetIndex = randomBetween(0, buttons.length - 2);
    buttons.forEach((button, index) => {
      button.classList.toggle("green", index === targetIndex);
      button.classList.toggle("decoy", index !== targetIndex);
      button.textContent = index === targetIndex ? "Green" : labels[index];
    });
  }

  function handleClick(event) {
    const clicked = event.target.closest(".panic-button");
    if (!clicked) return;

    if (Number(clicked.dataset.index) === targetIndex) {
      wins += 1;
      setScore(`${wins}/3`);
      setPrompt(wins >= 3 ? "Button panic successfully managed." : "Correct. It hates that.");
      chooseNewTarget();
      scatterButtons();
      if (wins >= 3) {
        buttons.forEach((button) => button.disabled = true);
      }
      return;
    }

    setPrompt(clicked.textContent === "Double" ? "That one needs a double-click." : "Decoy. Rude, but educational.");
  }

  function handleDoubleClick(event) {
    const clicked = event.target.closest(".panic-button");
    if (!clicked || clicked.textContent !== "Double") return;
    chooseNewTarget();
    scatterButtons();
    setPrompt("The double-click button shuffled reality.");
  }

  field.addEventListener("click", handleClick);
  field.addEventListener("dblclick", handleDoubleClick);
  buttons.forEach((button) => {
    button.addEventListener("mouseenter", scatterButtons);
  });

  scatterButtons();
  intervalIds.push(setInterval(scatterButtons, 1900));

  return () => {
    clearIntervals(intervalIds);
    field.removeEventListener("click", handleClick);
    field.removeEventListener("dblclick", handleDoubleClick);
  };
}

// Game 4: keydown starts actions and keyup ends them, so both events matter.
function initKeyboardGoblin() {
  const activeKeys = new Set();
  const commands = [
    { text: "Tap A S D", type: "sequence", keys: ["a", "s", "d"] },
    { text: "Hold Space", type: "hold", key: " ", duration: 900 },
    { text: "Left Right Left", type: "sequence", keys: ["arrowleft", "arrowright", "arrowleft"] },
    { text: "Hold Shift", type: "hold", key: "shift", duration: 800 },
    { text: "Tap W A W", type: "sequence", keys: ["w", "a", "w"] }
  ];
  let commandIndex = 0;
  let sequenceIndex = 0;
  let holdTimer = null;
  let score = 0;

  gameStage.innerHTML = `
    <div class="keyboard-stage">
      <div id="keyboardCommand" class="keyboard-command"></div>
      <div class="key-row">
        <div class="keycap" data-key="a">A</div>
        <div class="keycap" data-key="s">S</div>
        <div class="keycap" data-key="d">D</div>
        <div class="keycap" data-key=" ">Space</div>
        <div class="keycap" data-key="shift">Shift</div>
      </div>
    </div>
  `;

  const commandLabel = gameStage.querySelector("#keyboardCommand");
  const keycaps = Array.from(gameStage.querySelectorAll(".keycap"));

  setPrompt("Click the stage once if the browser needs focus, then obey the keyboard orders.");
  showCommand();

  function currentCommand() {
    return commands[commandIndex % commands.length];
  }

  function showCommand() {
    const command = currentCommand();
    commandLabel.textContent = command.text;
    setScore(`${score} cleared`);
    sequenceIndex = 0;
  }

  function finishCommand(message) {
    score += 1;
    commandIndex += 1;
    setPrompt(message);
    showCommand();
  }

  function updateKeycaps() {
    keycaps.forEach((keycap) => {
      keycap.classList.toggle("active", activeKeys.has(keycap.dataset.key));
    });
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if ([" ", "arrowleft", "arrowright", "shift"].includes(key)) {
      event.preventDefault();
    }
    if (activeKeys.has(key)) return;
    activeKeys.add(key);
    updateKeycaps();

    const command = currentCommand();
    if (command.type === "sequence") {
      if (key === command.keys[sequenceIndex]) {
        sequenceIndex += 1;
        setPrompt(`${sequenceIndex}/${command.keys.length}`);
        if (sequenceIndex >= command.keys.length) {
          finishCommand("Sequence accepted. Suspiciously competent.");
        }
      } else {
        sequenceIndex = 0;
        setPrompt("Wrong key. The order resets.");
      }
    }

    if (command.type === "hold" && key === command.key) {
      setPrompt("Keep holding...");
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (activeKeys.has(command.key)) {
          finishCommand("Held long enough. Release when ready.");
        }
      }, command.duration);
    }
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    activeKeys.delete(key);
    updateKeycaps();
    const command = currentCommand();
    if (command.type === "hold" && key === command.key && holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      setPrompt("Released too early. Hold means hold.");
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    clearTimeout(holdTimer);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}

// Game 5: input events fire constantly while sliders move, which is perfect for live feedback.
function initSliderSafecracker() {
  const target = { pitch: 91, pressure: 9, sparkle: 88 };

  gameStage.innerHTML = `
    <div class="safe-stage">
      <div class="vault-face">
        <div id="vaultDial" class="vault-dial"></div>
      </div>
      <div class="slider-panel">
        ${sliderMarkup("pitch", "Pitch", 50)}
        ${sliderMarkup("pressure", "Pressure", 50)}
        ${sliderMarkup("sparkle", "Sparkle", 50)}
        <div class="meter" aria-label="Closeness meter"><div id="safeMeter" class="meter-fill"></div></div>
      </div>
    </div>
  `;

  const sliders = Array.from(gameStage.querySelectorAll("input[type='range']"));
  const meter = gameStage.querySelector("#safeMeter");
  const dial = gameStage.querySelector("#vaultDial");

  function sliderMarkup(id, label, value) {
    return `
      <div class="slider-row">
        <label for="${id}"><span>${label}</span><span id="${id}Value">${value}</span></label>
        <input id="${id}" type="range" min="0" max="100" value="${value}">
      </div>
    `;
  }

  function updateSafe() {
    const values = Object.fromEntries(sliders.map((slider) => [slider.id, Number(slider.value)]));
    sliders.forEach((slider) => {
      gameStage.querySelector(`#${slider.id}Value`).textContent = slider.value;
    });

    const totalDistance = Object.keys(target).reduce((sum, key) => sum + Math.abs(target[key] - values[key]), 0);
    const closeness = clamp(Math.round(100 - totalDistance / 3), 0, 100);
    meter.style.setProperty("--amount", `${closeness}%`);
    dial.style.setProperty("--dial-rotation", `${values.pitch * 3.6}deg`);
    gameStage.style.filter = `saturate(${1 + closeness / 90})`;
    setScore(`${closeness}%`);

    if (closeness >= 96) {
      setPrompt("Vault opened. It was mostly sparkle-based security.");
    } else if (closeness >= 80) {
      setPrompt("Very warm. The dial is sweating.");
    } else if (closeness >= 55) {
      setPrompt("Something clunks in a promising way.");
    } else {
      setPrompt("The vault is unimpressed.");
    }
  }

  sliders.forEach((slider) => slider.addEventListener("input", updateSafe));
  updateSafe();

  return () => {
    sliders.forEach((slider) => slider.removeEventListener("input", updateSafe));
    gameStage.style.filter = "";
  };
}

// Game 6: mouseenter and mouseleave can create behavior without clicks.
function initDoNotHover() {
  const timers = [];
  let alarms = 0;

  gameStage.innerHTML = `<div class="hover-stage playfield"></div>`;
  const field = gameStage.querySelector(".hover-stage");

  setPrompt("Click the prize. Try not to hover over the square traps.");
  setScore("0 alarms");

  const prize = document.createElement("button");
  prize.className = "hover-prize";
  prize.type = "button";
  prize.textContent = "Prize";
  field.append(prize);

  const trapLabels = ["Oops", "Nope", "Wait", "Trap", "Yell", "Fake", "Blink", "Scoot", "Alarm"];
  const traps = trapLabels.map((label) => {
    const trap = document.createElement("div");
    trap.className = "hover-trap";
    trap.textContent = label;
    field.append(trap);
    return trap;
  });

  function placeElement(element, size) {
    const rect = field.getBoundingClientRect();
    element.style.left = `${randomBetween(10, Math.max(10, rect.width - size - 10))}px`;
    element.style.top = `${randomBetween(10, Math.max(10, rect.height - size - 10))}px`;
  }

  function scatterAll() {
    placeElement(prize, 116);
    traps.forEach((trap) => placeElement(trap, 94));
  }

  function handlePrizeClick() {
    setPrompt("You clicked the prize. The traps are pretending this was easy.");
    setScore("Prize");
    prize.disabled = true;
  }

  function handleTrapEnter(event) {
    const trap = event.currentTarget;
    alarms += 1;
    setScore(`${alarms} alarms`);
    setPrompt("A trap noticed you. It is making a whole thing of it.");
    trap.classList.add("alarm");

    if (alarms % 3 === 0) {
      trap.classList.add("vanish");
      timers.push(setTimeout(() => {
        trap.classList.remove("vanish");
        placeElement(trap, 94);
      }, 900));
    } else {
      placeElement(trap, 94);
    }
  }

  function handleTrapLeave(event) {
    event.currentTarget.classList.remove("alarm");
  }

  prize.addEventListener("click", handlePrizeClick);
  traps.forEach((trap) => {
    trap.addEventListener("mouseenter", handleTrapEnter);
    trap.addEventListener("mouseleave", handleTrapLeave);
  });

  scatterAll();

  return () => {
    clearTimers(timers);
    prize.removeEventListener("click", handlePrizeClick);
    traps.forEach((trap) => {
      trap.removeEventListener("mouseenter", handleTrapEnter);
      trap.removeEventListener("mouseleave", handleTrapLeave);
    });
  };
}

// Game 7: wheel events include delta values, so we can reward a steady scrolling rate.
function initWheelRunaway() {
  let speed = 35;
  let energy = 82;
  let monster = 18;
  let runner = 42;
  let finished = false;
  const intervalIds = [];

  gameStage.innerHTML = `
    <div class="wheel-stage">
      <div id="raceLane" class="race-lane">
        <div id="monster" class="monster"></div>
        <div id="runner" class="runner"></div>
      </div>
      <div class="race-hud">
        <div class="race-stat">Speed: <span id="speedValue">35</span></div>
        <div class="race-stat">Energy: <span id="energyValue">82</span></div>
        <div class="race-stat">Gap: <span id="gapValue">24</span></div>
      </div>
    </div>
  `;

  const lane = gameStage.querySelector("#raceLane");
  const speedValue = gameStage.querySelector("#speedValue");
  const energyValue = gameStage.querySelector("#energyValue");
  const gapValue = gameStage.querySelector("#gapValue");

  setPrompt("Scroll over the race lane. Steady scroll wins; frantic scroll drains energy.");

  function updateRace() {
    if (finished) return;
    speed = clamp(speed - 1.1, 0, 100);
    energy = clamp(energy + 0.28 - speed * 0.012, 0, 100);
    runner = clamp(18 + speed * 0.64, 12, 82);
    monster = clamp(monster + (speed < 24 ? 1.6 : 0.35), 6, 78);

    const gap = Math.round(runner - monster);
    speedValue.textContent = String(Math.round(speed));
    energyValue.textContent = String(Math.round(energy));
    gapValue.textContent = String(gap);
    lane.style.setProperty("--runner-left", `${runner}%`);
    lane.style.setProperty("--monster-left", `${monster}%`);
    setScore(`${Math.max(0, gap)} gap`);

    if (energy <= 2) {
      finished = true;
      setPrompt("Out of energy. Scroll panic is still panic.");
      setScore("Overheated");
    } else if (gap <= 3) {
      finished = true;
      setPrompt("Caught. The monster appreciates your mouse wheel demonstration.");
      setScore("Caught");
    } else if (gap >= 58) {
      finished = true;
      setPrompt("Escaped with suspiciously good scrolling form.");
      setScore("Escaped");
    }
  }

  function handleWheel(event) {
    event.preventDefault();
    if (finished) return;
    const effort = clamp(Math.abs(event.deltaY) / 24, 1, 9);
    speed = clamp(speed + effort * 2.8, 0, 100);
    energy = clamp(energy - effort * 1.2, 0, 100);
    setPrompt(effort > 6 ? "Too spicy. Energy is draining fast." : "Good scroll rhythm.");
    updateRace();
  }

  lane.addEventListener("wheel", handleWheel, { passive: false });
  intervalIds.push(setInterval(updateRace, 160));
  updateRace();

  return () => {
    clearIntervals(intervalIds);
    lane.removeEventListener("wheel", handleWheel);
  };
}

// Game 8: Drag/drop events pass data through dataTransfer and the drop zone decides what to do.
function initDragLab() {
  const items = [
    { name: "Loud Triangle", type: "shape" },
    { name: "Blue Soup", type: "color" },
    { name: "Tiny Anvil", type: "weight" },
    { name: "Square Mood", type: "shape" },
    { name: "Red Weather", type: "color" },
    { name: "Heavy Feather", type: "weight" }
  ];
  const bins = [
    { label: "Shapes", type: "shape" },
    { label: "Colors", type: "color" },
    { label: "Weights", type: "weight" }
  ];
  let placed = 0;

  gameStage.innerHTML = `
    <div class="drag-stage">
      <div id="dragItems" class="drag-items" aria-label="Draggable items"></div>
      <div id="dropBins" class="drop-bins" aria-label="Drop bins"></div>
    </div>
  `;

  const itemColumn = gameStage.querySelector("#dragItems");
  const binColumn = gameStage.querySelector("#dropBins");

  setPrompt("Drag each odd object into its matching bin.");
  setScore("0/6");

  items.forEach((item, index) => {
    const element = document.createElement("div");
    element.className = "drag-item";
    element.draggable = true;
    element.id = `drag-item-${index}`;
    element.dataset.type = item.type;
    element.textContent = item.name;
    element.style.background = index % 2 ? "var(--cyan)" : "var(--yellow)";
    itemColumn.append(element);
  });

  bins.forEach((bin) => {
    const element = document.createElement("div");
    element.className = "drop-bin";
    element.dataset.type = bin.type;
    element.textContent = bin.label;
    binColumn.append(element);
  });

  const dragItems = Array.from(gameStage.querySelectorAll(".drag-item"));
  const dropBins = Array.from(gameStage.querySelectorAll(".drop-bin"));

  function handleDragStart(event) {
    event.dataTransfer.setData("text/plain", event.currentTarget.id);
    event.dataTransfer.effectAllowed = "move";
    setPrompt(`Dragging ${event.currentTarget.textContent}.`);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("over");
  }

  function handleDragLeave(event) {
    event.currentTarget.classList.remove("over");
  }

  function handleDrop(event) {
    event.preventDefault();
    const bin = event.currentTarget;
    bin.classList.remove("over");
    const itemId = event.dataTransfer.getData("text/plain");
    const item = document.getElementById(itemId);
    if (!item || item.classList.contains("done")) return;

    if (item.dataset.type === bin.dataset.type) {
      item.classList.add("done");
      item.draggable = false;
      placed += 1;
      bin.classList.add("full");
      setScore(`${placed}/6`);
      setPrompt(placed === items.length ? "Everything is sorted. The labels feel seen." : "Accepted. The bin nodded politely.");
      return;
    }

    item.classList.remove("shake");
    void item.offsetWidth;
    item.classList.add("shake");
    setPrompt("Rejected. That bin has standards.");
  }

  dragItems.forEach((item) => item.addEventListener("dragstart", handleDragStart));
  dropBins.forEach((bin) => {
    bin.addEventListener("dragover", handleDragOver);
    bin.addEventListener("dragleave", handleDragLeave);
    bin.addEventListener("drop", handleDrop);
  });

  return () => {
    dragItems.forEach((item) => item.removeEventListener("dragstart", handleDragStart));
    dropBins.forEach((bin) => {
      bin.removeEventListener("dragover", handleDragOver);
      bin.removeEventListener("dragleave", handleDragLeave);
      bin.removeEventListener("drop", handleDrop);
    });
  };
}
