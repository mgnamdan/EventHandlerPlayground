// Everything waits until the HTML has been parsed.
document.addEventListener("DOMContentLoaded", () => {
  // Different selectors, used deliberately: ID, class, attribute, and descendants.
  const lobby = document.getElementById("lobby");
  const arena = document.querySelector("#arena");
  const cards = document.querySelectorAll("[data-game]");
  const stage = document.getElementById("stage");
  const score = document.getElementById("score");
  const result = document.getElementById("result");
  const startButton = document.querySelector(".game-actions #start");
  const nextButton = document.getElementById("next");
  const timed = document.getElementById("timed");
  const log = document.getElementById("eventLog");
  const cabinet = document.querySelector(".cabinet");
  const feedbackBar = document.getElementById("feedback");
  const completed = new Set();
  let current = 0;
  let playing = false;
  let timers = [];
  let cleanup = () => {};
  let lastLogTime = 0;
  let feedbackTimer = null;

  const jobs = [
    {
      title: "Sticky fingers", icon: "🥄", seconds: 20,
      instructions: "Lift 8 silver spoons for Kip’s midnight picnic. Tap the spoon, not the alarm bells. Ring a bell and Kip drops one spoon. The spoon moves to a new slot at unpredictable intervals, getting faster as you score!",
      lesson: "One click listener on the drawer handles all six buttons. Events bubble from the clicked element to its parent. closest() finds the button even if you click its contents.",
      example: 'tray.addEventListener("click", (event) => {\n  const spoon = event.target.closest("button");\n  if (!spoon) return;\n  // Check which spoon was clicked.\n});',
      play: playSpoons
    },
    {
      title: "A leap of mischief", icon: "☾", seconds: 25,
      instructions: "Help Kip clear 3 rooftops. Hold Space or the jump button; release in the marked 70–80% zone. Too little sends him into the gap; too much flings him past the roof! Misses return him to the same roof. Each successful leap speeds up the meter slightly.",
      lesson: "keydown begins charging and keyup launches. event.repeat ignores repeated keydown events from a held key. Pointer capture makes releasing outside the button work too.",
      example: 'pad.addEventListener("keydown", (event) => {\n  if (event.code === "Space" && !event.repeat) {\n    event.preventDefault();\n    // Begin charging.\n  }\n});\npad.addEventListener("keyup", launch);',
      play: playRooftops
    },
    {
      title: "Pack the swag", icon: "✉", seconds: 30,
      instructions: "Pack 8 shuffled picnic supplies into their labelled getaway bags. Drag an item into its matching bag, or select an item and then its bag. A wrong match stays on the table. Check the labels—the bag order changes each round.",
      lesson: "dragstart stores an item ID in dataTransfer. dragover calls preventDefault() to allow dropping. drop reads that ID. The click alternative works with touch and keyboard.",
      example: 'item.addEventListener("dragstart", (event) => {\n  event.dataTransfer.setData("text/plain", item.id);\n});\nbin.addEventListener("dragover", (event) => {\n  event.preventDefault();\n});\nbin.addEventListener("drop", deliver);',
      play: playSwag
    },
    {
      title: "Crumbs & tumblers", icon: "◎", seconds: 30,
      instructions: "Crack the biscuit safe’s 3 tumblers. Drag around the knob: COLD → WARM → HOT → CLICK. Release on CLICK to set a tumbler. Each tumbler needs a little more precision. Keyboard: arrow keys, then Enter. The fine-adjustment slider works too.",
      lesson: "pointermove turns the knob using the pointer’s angle. Pointer capture keeps the drag connected outside the knob. The fine-adjustment slider uses input for live feedback and change to test the tumbler. Both controls share the same two functions.",
      example: 'knob.addEventListener("pointermove", turnKnob);\nknob.addEventListener("pointerup", testTumbler);\n\nfineDial.addEventListener("input", () => {\n  setValue(Number(fineDial.value));\n});\nfineDial.addEventListener("change", testTumbler);',
      play: playSafe
    },
    {
      title: "The quiet bit", icon: "👁", seconds: 25,
      instructions: "Swipe the biscuits while the guard sleeps. His naps vary, so watch for the warning and leave before he wakes! Touch: hold and release. Keyboard: focus the tin, hold Space, then release. Getting spotted costs 30%.",
      lesson: "pointerenter and pointerleave detect crossing a boundary. They support pointer devices beyond a mouse. focus explains the keyboard control; pointercancel and blur stop an interrupted interaction safely.",
      example: 'tin.addEventListener("pointerenter", () => {\n  stealing = true;\n});\ntin.addEventListener("pointerleave", () => {\n  stealing = false;\n});',
      play: playSneak
    },
    {
      title: "Signed, definitely Pip", icon: "⌨", seconds: 25,
      instructions: "Leave 3 cheeky calling cards to distract Mayor Magpie. Copy each message and its changing two-digit signature, then press Enter or Leave note. Capitalization does not matter. Fix any typo and try again.",
      lesson: "submit belongs to the form, so both Enter and the Leave note button work. preventDefault() stops navigation. input checks progress; focus and blur track entering and leaving the field.",
      example: 'form.addEventListener("submit", (event) => {\n  event.preventDefault();\n  const answer = field.value.trim().toUpperCase();\n  // Compare with the requested code.\n});',
      play: playCallingCard
    }
  ];

  // Shared round controls. Game listeners on removed HTML disappear with it.
  // Any window listeners must be removed by the game's cleanup function.
  function stopRound() {
    playing = false;
    timers.forEach((id) => clearInterval(id));
    timers = [];
    cleanup();
    cleanup = () => {};
    clearTimeout(feedbackTimer);
    delete cabinet.dataset.feedback;
    delete stage.dataset.guard;
    stage.querySelectorAll("[data-reaction]").forEach((element) => delete element.dataset.reaction);
  }

  // A colour cue, a readable message, and an optional reaction on the object.
  // One resettable timer prevents rapid clicks from stacking flashes or callbacks.
  function feedback(tone, message, element = null) {
    clearTimeout(feedbackTimer);
    cabinet.dataset.feedback = tone;
    feedbackBar.dataset.tone = tone;
    feedbackBar.textContent = message;
    stage.querySelectorAll("[data-reaction]").forEach((item) => delete item.dataset.reaction);
    if (element) element.dataset.reaction = tone;
    feedbackTimer = setTimeout(() => {
      delete cabinet.dataset.feedback;
      if (element) delete element.dataset.reaction;
    }, 850);
  }

  function every(callback, milliseconds) {
    timers.push(setInterval(callback, milliseconds));
  }

  // Shuffle in place, once at the start of a round (never under a player's drag).
  function shuffleItems(items) {
    for (let index = items.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
  }

  function record(event, detail = "") {
    // Frequent input/movement events should not flood the teaching panel.
    if (["input", "dragover", "pointermove"].includes(event.type) && Date.now() - lastLogTime < 120) return;
    lastLogTime = Date.now();
    const line = document.createElement("li");
    line.textContent = `${event.type} → ${detail || event.target.tagName.toLowerCase()}`;
    log.prepend(line);
    if (log.children.length > 5) log.lastElementChild.remove();
  }

  function openJob(index) {
    stopRound();
    current = index;
    const job = jobs[index];
    lobby.hidden = true;
    arena.hidden = false;
    document.getElementById("gameTitle").textContent = job.title;
    document.getElementById("jobNumber").textContent = `HEIST 0${index + 1} / 06`;
    document.getElementById("instructions").textContent = job.instructions;
    document.getElementById("lesson").textContent = job.lesson;
    document.getElementById("example").textContent = job.example;
    stage.innerHTML = `<span class="big-icon" aria-hidden="true">${job.icon}</span><h2>Ready, partner?</h2><p>Read the plan. Kip will try to look innocent.</p>`;
    stage.dataset.scene = ["drawer", "roofs", "swag", "vault", "guard", "notes"][index];
    score.textContent = "Kip is casing the joint";
    document.getElementById("timer").textContent = `${job.seconds}s challenge`;
    result.textContent = "Tip: turn off the clock to explore the events at your own pace.";
    result.className = "";
    feedbackBar.textContent = "THE PLAN IS SIMPLE. MOSTLY.";
    delete feedbackBar.dataset.tone;
    document.getElementById("timer").classList.remove("urgent");
    log.replaceChildren();
    startButton.hidden = false;
    startButton.textContent = "Begin heist →";
    nextButton.hidden = true;
    timed.disabled = false;
    startButton.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function finish(won, message) {
    if (!playing) return;
    stopRound();
    result.textContent = message;
    result.className = won ? "win" : "lose";
    feedback(won ? "success" : "alarm", won ? "✓ CLEAN GETAWAY!" : "☀ SUNRISE! TIME TO SCARPER.");
    if (won) {
      completed.add(current);
      cards[current].classList.add("done");
      document.getElementById("completion").textContent = `${completed.size} / 6 heists pulled off this visit`;
      if (completed.size === jobs.length) {
        result.textContent += " Caper complete! Maple Street gets its midnight picnic. Pip gets an alibi to explain.";
      }
    }
    // Freeze finished controls, leaving the result visible for inspection.
    stage.querySelectorAll("button, input").forEach((element) => element.disabled = true);
    stage.querySelectorAll('[role="slider"]').forEach((element) => {
      element.setAttribute("aria-disabled", "true");
      element.tabIndex = -1;
    });
    startButton.hidden = false;
    startButton.textContent = "Try again ↻";
    nextButton.hidden = false;
    timed.disabled = false;
    startButton.focus();
  }

  cards.forEach((card) => card.addEventListener("click", () => openJob(Number(card.dataset.game))));
  document.getElementById("shuffle").addEventListener("click", () => openJob(Math.floor(Math.random() * jobs.length)));
  document.getElementById("restart").addEventListener("click", () => openJob(current));
  nextButton.addEventListener("click", () => openJob((current + 1) % jobs.length));
  document.getElementById("back").addEventListener("click", () => {
    stopRound();
    arena.hidden = true;
    lobby.hidden = false;
    stage.replaceChildren();
    cards[current].focus();
  });
  startButton.addEventListener("click", () => {
    stopRound();
    playing = true;
    result.className = "";
    result.textContent = "Kip: “Quick paws. Quiet feet. We’ve got this.”";
    if (!timed.checked) result.textContent = "Rehearsal mode. Even a rascal needs practice.";
    log.replaceChildren();
    startButton.hidden = true;
    nextButton.hidden = true;
    timed.disabled = true;
    jobs[current].play();
    feedback("neutral", "YOU'RE UP, PARTNER.");
    stage.scrollIntoView({ block: "center" });
    const deadline = Date.now() + jobs[current].seconds * 1000;
    const timer = document.getElementById("timer");
    timer.textContent = timed.checked ? `${jobs[current].seconds}s left` : "Untimed practice";
    timer.classList.remove("urgent");
    if (timed.checked) every(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timer.textContent = `${left}s left`;
      timer.classList.toggle("urgent", left > 0 && left <= 5);
      if (left === 0) finish(false, "Sunrise! Kip retreats with his dignity mostly intact. Try again or switch off the clock.");
    }, 100);
  });

  // 1. CLICK: one parent listener, six clickable children.
  function playSpoons() {
    stage.innerHTML = '<p>Mayor Magpie’s silver drawer. Spoons only. No bells!</p><div class="spoon-grid"></div><div id="spoonPocket" class="spoon-pocket" aria-label="0 of 8 spoons collected">· · · · · · · ·</div>';
    const tray = stage.querySelector(".spoon-grid");
    let caught = 0;
    let nextShuffle = 0;
    let previousTarget = -1;
    for (let i = 0; i < 6; i++) {
      const button = document.createElement("button");
      button.type = "button";
      tray.append(button);
    }
    function shuffle() {
      let target;
      do { target = Math.floor(Math.random() * 6); } while (target === previousTarget);
      previousTarget = target;
      Array.from(tray.children).forEach((spoon, index) => {
        spoon.dataset.good = String(index === target);
        spoon.textContent = index === target ? "🥄" : "🔔";
        spoon.setAttribute("aria-label", index === target ? "Silver spoon" : "Alarm bell");
      });
      const minimum = Math.max(480, 800 - caught * 45);
      nextShuffle = Date.now() + minimum + Math.random() * 400;
    }
    tray.addEventListener("click", (event) => {
      const spoon = event.target.closest("button");
      if (!playing || !spoon) return;
      record(event, spoon.getAttribute("aria-label"));
      const good = spoon.dataset.good === "true";
      const lost = caught > 0;
      caught = good ? caught + 1 : Math.max(0, caught - 1);
      const pocket = document.getElementById("spoonPocket");
      feedback(good ? "success" : "alarm", good ? "+1 SPOON · neatly nicked!" : lost ? "🔔 ALARM! −1 SPOON" : "🔔 ALARM! CAREFUL, KIP!", good ? pocket : tray);
      result.textContent = good ? "Lifted! Keep your eyes on the next spoon." : lost ? "Ding! Kip drops a spoon. Watch those bells." : "Ding! Nothing to drop yet, but that was much too loud.";
      pocket.textContent = "🥄 ".repeat(caught) + "· ".repeat(8 - caught);
      pocket.setAttribute("aria-label", `${caught} of 8 spoons collected`);
      score.textContent = `${caught} / 8 spoons`;
      if (caught === 8) finish(true, "Kip: “Eight spoons. A picnic is just a heist with cutlery.”");
      else shuffle();
    });
    score.textContent = "0 / 8 spoons";
    shuffle();
    every(() => { if (Date.now() >= nextShuffle) shuffle(); }, 40);
    tray.firstElementChild.focus();
  }

  // 2. KEYDOWN / KEYUP, with pointer controls for mouse and touch.
  function playRooftops() {
    stage.innerHTML = `
      <div class="roof-scene" aria-label="Kip crossing four rooftops">
        <span class="roof-moon" aria-hidden="true">☾</span>
        <div class="roof-buildings" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <img id="rooftopKip" src="kip.svg" alt="Kip on the first rooftop">
        <span id="jumpVerdict" class="jump-verdict">ROOF 1 → 2</span>
      </div>
      <div class="meter"><div class="sweet-spot"></div><div class="meter-fill"></div></div>
      <p class="progress-text">0% · target 70–80%</p>
      <button class="hold-button">Hold Space / hold to jump</button>`;
    const pad = stage.querySelector("button");
    const fill = stage.querySelector(".meter-fill");
    const reading = stage.querySelector(".progress-text");
    const kip = document.getElementById("rooftopKip");
    const verdict = document.getElementById("jumpVerdict");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let held = false;
    let started = 0;
    let charge = 0;
    let launches = 0;
    let flight = null;
    function begin(event) {
      if (!playing || held || flight) return;
      record(event, "charge started");
      held = true;
      started = performance.now();
      fill.style.width = "0%";
      verdict.textContent = `ROOF ${launches + 1} → ${launches + 2}`;
      verdict.removeAttribute("data-outcome");
    }
    function launch(event) {
      if (!playing || !held) return;
      charge = ((performance.now() - started) / (18 - launches)) % 100;
      held = false;
      record(event, `${Math.round(charge)}% charge`);
      const landed = charge >= 70 && charge <= 80;
      const short = charge < 70;
      // Percentage positions keep the jump proportional on phones and desktops.
      const distance = landed ? 25 : short ? 11 + charge / 70 * 3 : 36 + (charge - 80) / 20 * 3;
      flight = { started: performance.now(), from: 12.5 + launches * 25, distance, landed, short };
      fill.style.width = `${charge}%`;
      reading.textContent = `${charge.toFixed(1)}% released · target 70–80%`;
      verdict.textContent = landed ? "NICE TRAJECTORY!" : short ? "TOO SHORT!" : "TOO FAR!";
      verdict.dataset.outcome = landed ? "landed" : "missed";
      result.textContent = landed ? "Looking good… stick the landing!" : short ? "Not enough oomph! Kip is heading for the gap." : "Too much oomph! Kip sails straight past the roof.";
      feedback(landed ? "neutral" : "error", landed ? "ON TARGET · stick the landing…" : short ? "TOO SHORT · hold a little longer" : "TOO FAR · release a little sooner");
      pad.setAttribute("aria-disabled", "true");
      pad.textContent = "Kip is airborne…";
    }
    pad.addEventListener("keydown", (event) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (!event.repeat) begin(event);
    });
    pad.addEventListener("keyup", (event) => {
      if (event.code === "Space") { event.preventDefault(); launch(event); }
    });
    pad.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      pad.setPointerCapture(event.pointerId);
      begin(event);
    });
    pad.addEventListener("pointerup", launch);
    function cancel(event) { held = false; record(event, "charge cancelled"); }
    pad.addEventListener("pointercancel", cancel);
    pad.addEventListener("lostpointercapture", () => { held = false; });
    pad.addEventListener("blur", cancel);
    window.addEventListener("blur", cancel);
    cleanup = () => {
      window.removeEventListener("blur", cancel);
      flight = null;
      held = false;
    };
    every(() => {
      if (held) {
        charge = ((performance.now() - started) / (18 - launches)) % 100;
        fill.style.width = `${charge}%`;
        reading.textContent = `${Math.round(charge)}% · target 70–80%`;
      }
      if (!flight) return;
      const elapsed = performance.now() - flight.started;
      const progress = Math.min(1, elapsed / 850);
      const drop = flight.landed ? 0 : Math.max(0, (progress - .65) / .35) * 125;
      kip.style.left = `${flight.from + flight.distance * (reducedMotion ? 1 : progress)}%`;
      kip.style.bottom = `${62 + (reducedMotion ? 0 : Math.sin(progress * Math.PI) * 70 - drop)}px`;
      kip.style.transform = `translateX(-50%) rotate(${reducedMotion || flight.landed ? 0 : progress * (flight.short ? -90 : 220)}deg)`;
      // Leave a brief beat after a miss, then put Kip back without losing a roof.
      if (elapsed < (flight.landed ? 850 : 1250)) return;
      const landed = flight.landed;
      if (landed) launches++;
      flight = null;
      kip.style.left = `${12.5 + launches * 25}%`;
      kip.style.bottom = "62px";
      kip.style.transform = "translateX(-50%)";
      kip.alt = `Kip on rooftop ${launches + 1}`;
      if (landed) verdict.textContent = `LANDED · ROOF ${launches + 1}`;
      score.textContent = `${launches} / 3 rooftops`;
      pad.removeAttribute("aria-disabled");
      pad.textContent = "Hold Space / hold to jump";
      result.textContent = landed ? "Clean landing! The next jump charges a little faster." : "A soft landing in the laundry. Back on the same roof—try again!";
      feedback(landed ? "success" : "neutral", landed ? `✓ ROOF ${launches + 1} REACHED` : "BACK ON THE ROOF · give it another go", landed ? stage.querySelectorAll(".roof-buildings i")[launches] : null);
      if (launches === 3) finish(true, "Kip: “Three rooftops. Zero witnesses. Only slightly ruffled.”");
    }, 25);
    score.textContent = "0 / 3 rooftops";
    pad.focus();
  }

  // 3. NATIVE DRAG AND DROP + a click alternative using the same deliver function.
  function playSwag() {
    stage.innerHTML = '<p>Pack the picnic supplies into the matching bags.</p><div class="mail-row"></div><div class="bins"><button class="bin" data-category="Spoons">🥄 Spoons</button><button class="bin" data-category="Cups">☕ Cups</button><button class="bin" data-category="Biscuits">🍪 Biscuits</button></div>';
    const tray = stage.querySelector(".mail-row");
    const categories = shuffleItems(["Spoons", "Cups", "Biscuits", "Cups", "Spoons", "Biscuits", "Spoons", "Biscuits"]);
    const bags = stage.querySelector(".bins");
    bags.querySelectorAll(".bin").forEach((bag) => {
      bag.dataset.packed = "0";
      const count = document.createElement("small");
      count.textContent = "0 packed";
      bag.append(count);
    });
    shuffleItems(Array.from(bags.children)).forEach((bag) => bags.append(bag));
    let selected = null;
    let delivered = 0;
    categories.forEach((category, index) => {
      const item = document.createElement("button");
      item.id = `item-${index}`;
      item.className = "item";
      item.draggable = true;
      item.dataset.category = category;
      item.textContent = `◇ ${category}`;
      item.setAttribute("aria-pressed", "false");
      tray.append(item);
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", item.id);
        item.classList.add("selected");
        feedback("neutral", `${item.dataset.category.toUpperCase()} IN PAW · choose a bag`);
        record(event, item.id);
      });
      item.addEventListener("dragend", () => {
        stage.querySelectorAll(".bin").forEach((bag) => bag.classList.remove("over"));
        item.classList.toggle("selected", item === selected);
      });
      item.addEventListener("click", (event) => {
        selected = item;
        tray.querySelectorAll("button").forEach((item) => {
          item.classList.toggle("selected", item === selected);
          item.setAttribute("aria-pressed", String(item === selected));
        });
        record(event, `selected ${item.dataset.category}`);
        feedback("neutral", `${item.dataset.category.toUpperCase()} SELECTED · now choose a bag`);
      });
    });
    function deliver(item, bin) {
      if (!playing) return;
      if (!item || !tray.contains(item)) {
        feedback("warning", "EMPTY PAWS · select a supply first", bin);
        return;
      }
      if (item.dataset.category !== bin.dataset.category) {
        result.textContent = "Wrong bag! Kip likes his biscuits without spoon-shaped dents.";
        feedback("error", `WRONG BAG · try the ${item.dataset.category} bag`, bin);
        return;
      }
      const wasSelected = item === selected;
      item.remove();
      if (wasSelected) selected = null;
      delivered++;
      bin.dataset.packed = Number(bin.dataset.packed) + 1;
      bin.querySelector("small").textContent = `${bin.dataset.packed} packed`;
      feedback("success", `✓ ${bin.dataset.category.toUpperCase()} PACKED · ${delivered}/${categories.length}`, bin);
      score.textContent = `${delivered} / ${categories.length} packed`;
      result.textContent = "Into the getaway bag. Beautifully organised mischief.";
      if (delivered === categories.length) finish(true, "Kip: “Pip would be proud of the sorting. Less proud of the circumstances.”");
    }
    stage.querySelectorAll(".bin").forEach((bin) => {
      bin.addEventListener("dragover", (event) => {
        event.preventDefault();
        bin.classList.add("over");
        record(event, "drop allowed");
      });
      bin.addEventListener("dragenter", (event) => record(event, bin.dataset.category));
      bin.addEventListener("dragleave", () => bin.classList.remove("over"));
      bin.addEventListener("drop", (event) => {
        event.preventDefault();
        bin.classList.remove("over");
        record(event, bin.dataset.category);
        deliver(document.getElementById(event.dataTransfer.getData("text/plain")), bin);
      });
      bin.addEventListener("click", (event) => { record(event, bin.dataset.category); deliver(selected, bin); });
    });
    score.textContent = `0 / ${categories.length} packed`;
    tray.firstElementChild.focus();
  }

  // 4. A circular pointer control and a native range input share simple functions.
  function playSafe() {
    stage.innerHTML = `
      <div class="safe-door">
        <p class="safe-brand">MAGPIE &amp; SONS · BISCUIT SECURITY</p>
        <div class="tumblers" aria-label="Unlocked tumblers"><span>1</span><span>2</span><span>3</span></div>
        <span class="dial-index" aria-hidden="true">▼</span>
        <div id="safeKnob" class="safe-knob" role="slider" tabindex="0"
          aria-label="Safe combination knob" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"
          aria-describedby="knobHelp">
          <div class="dial-face" aria-hidden="true"><span class="dial-mark"></span></div>
          <output id="reading">50</output>
        </div>
        <p id="signal" role="status">COLD · keep turning</p>
        <div class="warmth-scale" aria-hidden="true"><span data-level="cold">COLD</span><span data-level="warm">WARM</span><span data-level="hot">HOT</span><span data-level="click">CLICK</span></div>
      </div>
      <p id="knobHelp" class="hint">Drag around the knob. Release on CLICK.<br>Or use arrow keys, then Enter to set.</p>
      <label for="fineDial" class="hint">Fine adjustment (0–100)</label>
      <input id="fineDial" class="tuner" type="range" min="0" max="100" value="50">`;
    const knob = document.getElementById("safeKnob");
    const fineDial = document.getElementById("fineDial");
    const reading = document.getElementById("reading");
    const signal = document.getElementById("signal");
    const door = stage.querySelector(".safe-door");
    let target = 0;
    let value = 50;
    let unlocked = 0;
    let pointer = null;
    let lastAngle = 0;

    function newTumbler() {
      do { target = 10 + Math.floor(Math.random() * 81); }
      while (Math.abs(target - value) < 20);
      setValue(value);
      score.textContent = `${unlocked} / 3 tumblers · precision ±${3 - unlocked}`;
    }

    function setValue(number) {
      if (feedbackBar.dataset.tone === "error") feedback("neutral", "LISTEN CLOSELY · turn until it clicks");
      value = Math.max(0, Math.min(100, number));
      const shown = Math.round(value);
      const distance = Math.abs(value - target);
      const warmth = distance <= 3 - unlocked ? "click" : distance < 10 ? "hot" : distance < 25 ? "warm" : "cold";
      reading.textContent = shown;
      fineDial.value = shown;
      knob.style.setProperty("--turn", `${value * 2.7 - 135}deg`);
      knob.setAttribute("aria-valuenow", shown);
      knob.setAttribute("aria-valuetext", `${shown}, ${warmth}`);
      door.dataset.warmth = warmth;
      door.querySelectorAll(".warmth-scale span").forEach((step) => {
        step.classList.toggle("active", step.dataset.level === warmth);
      });
      signal.textContent = warmth === "click" ? "CLICK · release or press Enter!" : `${warmth.toUpperCase()} · ${warmth === "hot" ? "nearly there" : "keep turning"}`;
    }

    function testTumbler(event) {
      if (!playing) return;
      record(event, `tested ${Math.round(value)}`);
      if (Math.abs(value - target) > 3 - unlocked) {
        result.textContent = 'Kip: “Not quite. Listen for the click.”';
        // Arrow adjustments on the native slider also emit change: don't punish exploration.
        if (event.type !== "change") feedback("error", "NOT YET · turn until you see CLICK", knob);
        return;
      }
      const tumbler = stage.querySelectorAll(".tumblers span")[unlocked];
      tumbler.classList.add("unlocked");
      tumbler.textContent = "✓";
      tumbler.setAttribute("aria-label", `Tumbler ${unlocked + 1} unlocked`);
      unlocked++;
      feedback("success", `CLICK! TUMBLER ${unlocked}/3 SET`, tumbler);
      score.textContent = `${unlocked} / 3 tumblers`;
      if (unlocked === 3) {
        door.classList.add("open");
        signal.textContent = "OPEN · the biscuits are ours!";
        knob.setAttribute("aria-disabled", "true");
        knob.tabIndex = -1;
        finish(true, 'Kip: “They put biscuits in a safe. Honestly, that’s the real crime.”');
      } else {
        result.textContent = 'Click! One tumbler set. Keep turning for the next one.';
        newTumbler();
      }
    }

    // atan2 converts the pointer's position around the centre into degrees.
    function angleFrom(event) {
      const box = knob.getBoundingClientRect();
      return Math.atan2(event.clientY - box.top - box.height / 2,
        event.clientX - box.left - box.width / 2) * 180 / Math.PI;
    }

    knob.addEventListener("pointerdown", (event) => {
      if (!playing || event.button !== 0 || !event.isPrimary) return;
      pointer = event.pointerId;
      lastAngle = angleFrom(event);
      knob.setPointerCapture(pointer);
      knob.focus({ preventScroll: true });
      record(event, "gripped the dial");
    });
    knob.addEventListener("pointermove", (event) => {
      if (!playing || event.pointerId !== pointer) return;
      const angle = angleFrom(event);
      // Wrap the difference at the -180/180 boundary to prevent sudden jumps.
      const difference = (angle - lastAngle + 540) % 360 - 180;
      lastAngle = angle;
      setValue(value + difference / 2.7);
      record(event, `dial ${Math.round(value)}`);
    });
    knob.addEventListener("pointerup", (event) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      testTumbler(event);
    });
    knob.addEventListener("pointercancel", () => { pointer = null; });
    knob.addEventListener("lostpointercapture", () => { pointer = null; });
    knob.addEventListener("keydown", (event) => {
      if (!playing) return;
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter", " "];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Enter" || event.key === " ") {
        if (!event.repeat) testTumbler(event);
      } else {
        if (event.key === "Home") setValue(0);
        else if (event.key === "End") setValue(100);
        else setValue(Math.round(value) + (["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1));
        record(event, `dial ${Math.round(value)}`);
      }
    });
    fineDial.addEventListener("input", (event) => {
      setValue(Number(fineDial.value));
      record(event, fineDial.value);
    });
    fineDial.addEventListener("change", testTumbler);
    score.textContent = "0 / 3 tumblers";
    newTumbler();
    knob.focus({ preventScroll: true });
  }

  // 5. ENTER / LEAVE controls progress. Random naps always include a warning.
  function playSneak() {
    stage.innerHTML = '<span class="big-icon" id="boss">😴</span><h2 id="bossState">Guard is sleeping…</h2><button class="sneak-pad">🍪 Biscuit tin</button><div class="meter"><div class="meter-fill"></div></div><p id="bagStatus" class="hint">Bag empty · wait for a quiet moment.</p>';
    const tin = stage.querySelector(".sneak-pad");
    const boss = document.getElementById("boss");
    const state = document.getElementById("bossState");
    const fill = stage.querySelector(".meter-fill");
    const bagStatus = document.getElementById("bagStatus");
    let stealing = false;
    let amount = 0;
    let cycleStarted = performance.now();
    let previous = cycleStarted;
    let napLength = 1700 + Math.random() * 700;
    let watchLength = 1400 + Math.random() * 500;
    const warningLength = 600;
    let previousMood = "";
    let lastMilestone = 0;
    function enter(event) {
      if (!playing) return;
      stealing = true;
      tin.classList.add("active");
      record(event, "borrowing biscuits");
      if (stage.dataset.guard === "sleeping") feedback("neutral", "FILLING THE BAG · eyes on the guard");
    }
    function leave(event) {
      const wasStealing = stealing;
      stealing = false;
      tin.classList.remove("active");
      record(event, "hands off");
      if (playing && wasStealing) feedback("neutral", "HANDS OFF · biscuits safely stashed");
    }
    tin.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") enter(event); });
    tin.addEventListener("pointerleave", leave);
    tin.addEventListener("pointerdown", (event) => { if (event.button === 0) { tin.setPointerCapture(event.pointerId); enter(event); } });
    tin.addEventListener("pointerup", leave);
    tin.addEventListener("pointercancel", leave);
    tin.addEventListener("lostpointercapture", leave);
    tin.addEventListener("focus", (event) => record(event, "Space to borrow"));
    tin.addEventListener("blur", leave);
    tin.addEventListener("keydown", (event) => { if (event.code === "Space") { event.preventDefault(); if (!event.repeat) enter(event); } });
    tin.addEventListener("keyup", (event) => { if (event.code === "Space") { event.preventDefault(); leave(event); } });
    window.addEventListener("blur", leave);
    cleanup = () => window.removeEventListener("blur", leave);
    every(() => {
      const now = performance.now();
      const elapsed = Math.min(now - previous, 100);
      previous = now;
      if (now - cycleStarted >= napLength + warningLength + watchLength) {
        cycleStarted = now;
        napLength = 1700 + Math.random() * 700;
        watchLength = 1400 + Math.random() * 500;
      }
      const phase = now - cycleStarted;
      const awake = phase >= napLength + warningLength;
      const mood = awake ? "awake" : phase >= napLength ? "warning" : "sleeping";
      stage.dataset.guard = mood;
      if (mood !== previousMood) {
        if (mood === "warning") feedback("warning", "! HE'S STIRRING · hands off NOW!");
        else if (mood === "awake") feedback("warning", "👁 WATCHING · stay still");
        else if (previousMood) feedback("neutral", "Zzz… COAST CLEAR · back to the biscuits");
        previousMood = mood;
      }
      boss.textContent = awake ? "👀" : phase >= napLength ? "🥱" : "😴";
      state.textContent = awake ? "GUARD IS WATCHING!" : phase >= napLength ? "Waking up! Hands off!" : "Guard is sleeping…";
      if (stealing && awake) {
        const lost = Math.min(30, amount);
        amount = Math.max(0, amount - 30);
        stealing = false;
        tin.classList.remove("active");
        result.textContent = `Caught! ${Math.round(lost)}% of the biscuits dropped. Leave and re-enter the tin to try again.`;
        feedback("alarm", `👁 CAUGHT! −${Math.round(lost)}% BISCUITS`, tin);
        lastMilestone = Math.floor(amount / 25);
      } else if (stealing) amount = Math.min(100, amount + elapsed / 65);
      const milestone = Math.floor(amount / 25);
      if (milestone > lastMilestone && amount < 100) {
        lastMilestone = milestone;
        if (mood === "sleeping") feedback("success", `${milestone * 25}% STASHED · keep it quiet`);
      }
      fill.style.width = `${amount}%`;
      bagStatus.textContent = `${Math.floor(amount)}% in the bag · ${stealing ? "filling…" : "hands off"}`;
      score.textContent = `${Math.floor(amount)}% / 100% biscuits`;
      if (amount >= 100) {
        bagStatus.textContent = "100% stashed · bag full!";
        finish(true, "Kip: “The biscuits are free. The guard is still dreaming. Perfect.”");
      }
    }, 50);
    score.textContent = "0% / 100% biscuits";
    tin.focus();
  }

  // 6. FORM EVENTS: submit works for both Enter and the button.
  function playCallingCard() {
    stage.innerHTML = '<p>KIP’S CALLING CARD</p><div class="order" id="order"></div><form class="dispatch" novalidate><label for="answer">Copy Kip’s note</label><input id="answer" name="answer" aria-describedby="typingHint" autocomplete="off" autocapitalize="characters" spellcheck="false" required maxlength="30"><button type="submit">Leave note →</button></form><p id="typingHint" class="hint">Leave no crumbs. Just a note.</p>';
    const form = stage.querySelector("form");
    const field = form.elements.namedItem("answer");
    const order = document.getElementById("order");
    const hint = document.getElementById("typingHint");
    const codes = ["THANKS FOR THE SNACKS", "BORROWED BY MOONLIGHT", "DEFINITELY NOT KIP", "COMPLIMENTS TO THE CHEF", "SIGNED YOUR NEIGHBOUR"];
    let sent = 0;
    let previous = "";
    function newOrder() {
      let code;
      do { code = codes[Math.floor(Math.random() * codes.length)]; } while (code === previous);
      previous = code;
      const message = `${code} #${10 + Math.floor(Math.random() * 90)}`;
      order.setAttribute("role", "group");
      order.setAttribute("aria-label", message);
      order.replaceChildren();
      for (const character of message) {
        const letter = document.createElement("span");
        letter.textContent = character;
        letter.setAttribute("aria-hidden", "true");
        order.append(letter);
      }
      field.value = "";
      field.removeAttribute("aria-invalid");
      delete field.dataset.state;
      hint.textContent = "Leave no crumbs. Just a note.";
      field.focus();
    }
    field.addEventListener("focus", (event) => record(event, "keyboard ready"));
    field.addEventListener("blur", (event) => record(event, "field left"));
    field.addEventListener("input", (event) => {
      record(event, `${field.value.length} characters`);
      const typed = field.value.trimStart().toUpperCase();
      const matches = order.textContent.startsWith(typed);
      const ready = typed.trimEnd() === order.textContent;
      Array.from(order.children).forEach((letter, index) => {
        letter.className = index >= typed.length ? "" : typed[index] === letter.textContent ? "typed-correct" : "typed-wrong";
      });
      field.dataset.state = ready ? "ready" : matches ? "typing" : "wrong";
      field.setAttribute("aria-invalid", String(!matches && !ready));
      hint.textContent = ready ? "✓ Exact match. Press Enter to leave your card!" : matches ? `${typed.length} / ${order.textContent.length} characters · keep going` : "✕ Check the underlined characters (and any extra letters).";
      if (ready) {
        feedback("success", "✓ EXACT MATCH · press Enter to leave it");
        result.textContent = "That’s the one. Leave your calling card!";
      } else if (!matches) {
        if (feedbackBar.dataset.tone !== "warning") feedback("warning", "TYPO SPOTTED · check the underlined characters");
        result.textContent = "Kip’s handwriting is questionable. His spelling needn’t be.";
      } else if (["error", "warning", "success"].includes(feedbackBar.dataset.tone)) {
        feedback("neutral", "BACK ON TRACK · keep typing");
        result.textContent = "Looking good. Don’t forget the signature.";
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!playing) return;
      record(event, "navigation prevented");
      if (field.value.trim().toUpperCase() !== order.textContent) {
        result.textContent = field.value.trim() ? "Not quite! Check the full note and its signature, then try again." : "An invisible calling card? Type the message first.";
        field.setAttribute("aria-invalid", "true");
        field.dataset.state = "wrong";
        feedback("error", field.value.trim() ? "✕ NOT QUITE · check the note and signature" : "EMPTY CARD · type Kip's note first", field);
        field.focus();
        return;
      }
      sent++;
      feedback("success", `✓ CALLING CARD ${sent}/3 LEFT`, form);
      score.textContent = `${sent} / 3 notes`;
      if (sent === 3) {
        hint.textContent = "✓ All three cards left. Time to disappear.";
        finish(true, "Kip: “A flawless getaway. Pip can explain the handwriting tomorrow.”");
      }
      else { result.textContent = "Calling card left. Kip has another terrible idea."; newOrder(); }
    });
    score.textContent = "0 / 3 notes";
    newOrder();
  }
});
