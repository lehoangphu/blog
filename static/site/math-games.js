/* Math Games for 2nd graders heading into 3rd grade.
   Five tap/pointer-only games (no keyboard or text input). A gallery of cards
   expands the chosen game to fill the page; a back button returns to the
   gallery. All rendering is vanilla DOM so it works without a build step. */
(function () {
    "use strict";

    var root = document.getElementById("math-games-root");
    if (!root) return;

    // ---------- small helpers ----------
    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    // ---------- sound effects ----------
    // Synthesized with the Web Audio API so there are no asset files to ship.
    // A bright two-note arpeggio means "correct"; a short low buzz means "wrong".
    var _audioCtx = null;
    function audioCtx() {
        if (_audioCtx) return _audioCtx;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            _audioCtx = new AC();
        } catch (e) {
            _audioCtx = null;
        }
        return _audioCtx;
    }
    function tone(ctx, freq, startAt, duration, type, peak) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || "sine";
        osc.frequency.value = freq;
        var t0 = ctx.currentTime + startAt;
        var vol = peak == null ? 0.18 : peak;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }
    function playSound(kind) {
        var ctx = audioCtx();
        if (!ctx) return;
        if (ctx.state === "suspended") {
            try { ctx.resume(); } catch (e) {}
        }
        if (kind === "correct") {
            // Rising major third + fifth: cheerful "ding-ding".
            tone(ctx, 660, 0, 0.16, "sine", 0.18);
            tone(ctx, 990, 0.1, 0.22, "sine", 0.16);
        } else {
            // Short descending buzz: gentle "uh-oh".
            tone(ctx, 200, 0, 0.22, "sawtooth", 0.12);
            tone(ctx, 150, 0.08, 0.22, "sawtooth", 0.1);
        }
    }

    var PRAISE = ["Nice!", "Great job!", "You got it!", "Awesome!", "Way to go!", "Correct!"];
    var ROUNDS = 10;
    var CHALLENGE_SECONDS = 30;

    // ---------- mode state (Practice vs Challenge) ----------
    var MODE_KEY = "mg_mode";
    function getMode() {
        try {
            return localStorage.getItem(MODE_KEY) === "challenge" ? "challenge" : "practice";
        } catch (e) {
            return "practice";
        }
    }
    function setMode(mode) {
        try {
            localStorage.setItem(MODE_KEY, mode);
        } catch (e) {
            /* ignore storage errors */
        }
    }

    // A single active countdown is tracked so navigating away cancels it.
    var activeTimer = null;
    function clearActiveTimer() {
        if (activeTimer) {
            clearInterval(activeTimer);
            activeTimer = null;
        }
    }
    function startCountdown(seconds, onTick, onDone) {
        clearActiveTimer();
        var remaining = seconds;
        onTick(remaining);
        activeTimer = setInterval(function () {
            remaining--;
            if (remaining <= 0) {
                clearActiveTimer();
                onTick(0);
                onDone();
            } else {
                onTick(remaining);
            }
        }, 1000);
        return {
            addTime: function (extra) {
                remaining += extra;
                onTick(remaining);
            },
        };
    }

    // Floating "+1s" reward shown on the timer when a bonus second is earned.
    function showTimeBonus(progressEl) {
        if (!progressEl) return;
        var bonus = el("span", "mg-timebonus", "\u2B50 +1s");
        progressEl.append(bonus);
        var remove = function () {
            if (bonus.parentNode) bonus.parentNode.removeChild(bonus);
        };
        bonus.addEventListener("animationend", remove);
        setTimeout(remove, 1200);
        progressEl.classList.remove("mg-bonus-pulse");
        void progressEl.offsetWidth; // force reflow so the pulse restarts
        progressEl.classList.add("mg-bonus-pulse");
    }

    // ---------- shared multiple-choice engine ----------
    // config: { makeQuestion() -> {promptHTML, answer}, spread, choices }
    // mode: "practice" (10 questions, first-try stars) or
    //       "challenge" (unlimited questions, score = correct answers in 30s).
    function runMultipleChoice(body, config, mode, game) {
        mode = mode || "practice";
        var challenge = mode === "challenge";
        var spread = config.spread || 6;
        var choiceCount = config.choices || 4;
        var score = 0;
        var round = 0;
        var firstTry = true;
        var over = false;

        var progress = el("div", "mg-progress");
        var stars = el("div", "mg-stars");
        var prompt = el("div", "mg-prompt");
        var choices = el("div", "mg-choices");
        var feedback = el("div", "mg-feedback");
        body.append(progress, stars, prompt, choices, feedback);

        var countdown = null;
        var progressText = null;
        if (challenge) {
            progress.classList.add("mg-timer");
            progressText = el("span", "mg-progress-text");
            progress.append(progressText);
        }

        function distractors(answer) {
            var set = {};
            set[answer] = true;
            var out = [answer];
            var guard = 0;
            while (out.length < choiceCount && guard < 200) {
                guard++;
                var d = answer + rand(-spread, spread);
                if (d < 0) continue;
                if (set[d]) continue;
                set[d] = true;
                out.push(d);
            }
            return shuffle(out);
        }

        function renderStatus(remaining) {
            if (challenge) {
                if (remaining != null && progressText) {
                    progressText.textContent = "\u23F1\uFE0F " + remaining + "s left";
                }
                stars.textContent = "Score: " + score;
            } else {
                stars.textContent = score > 0 ? Array(score + 1).join("\u2B50") : "";
            }
        }

        function next() {
            if (over) return;
            if (!challenge && round >= ROUNDS) return finish();
            round++;
            firstTry = true;
            if (!challenge) progress.textContent = "Question " + round + " of " + ROUNDS;
            renderStatus();
            var q = config.makeQuestion();
            prompt.innerHTML = q.promptHTML;
            feedback.textContent = "";
            feedback.className = "mg-feedback";
            choices.innerHTML = "";
            var options = q.choices ? shuffle(q.choices.slice()) : distractors(q.answer);
            options.forEach(function (val) {
                var b = el("button", "mg-choice", String(val));
                b.type = "button";
                b.addEventListener("click", function () {
                    if (b.disabled || over) return;
                    if (val === q.answer) {
                        b.classList.add("correct");
                        playSound("correct");
                        Array.prototype.forEach.call(choices.children, function (c) {
                            c.disabled = true;
                        });
                        if (firstTry) {
                            score++;
                            if (challenge && countdown) {
                                countdown.addTime(1);
                                showTimeBonus(progress);
                            }
                        }
                        feedback.textContent = pick(PRAISE);
                        feedback.className = "mg-feedback good";
                        renderStatus();
                        setTimeout(next, challenge ? 350 : 850);
                    } else {
                        firstTry = false;
                        b.classList.add("wrong");
                        b.disabled = true;
                        playSound("wrong");
                        feedback.textContent = "Try again!";
                        feedback.className = "mg-feedback bad";
                    }
                });
                choices.append(b);
            });
        }

        function finish() {
            clearActiveTimer();
            if (challenge) {
                var replay = function () {
                    body.innerHTML = "";
                    runMultipleChoice(body, config, mode, game);
                };
                var scoreText =
                    "You got " + score + " correct in " + CHALLENGE_SECONDS + " seconds!";
                renderChallengeDone(body, game, score, scoreText, replay);
                return;
            }
            body.innerHTML = "";
            var done = el("div", "mg-done");
            done.append(
                el("div", "mg-done-emoji", score >= 8 ? "\uD83C\uDFC6" : "\uD83C\uDF89"),
                el("div", "mg-done-title", "All done!"),
                el("div", "mg-done-score",
                    "You earned " + score + " of " + ROUNDS + " stars on the first try.")
            );
            var again = el("button", "mg-btn", "Play again");
            again.type = "button";
            again.addEventListener("click", function () {
                body.innerHTML = "";
                runMultipleChoice(body, config, mode, game);
            });
            done.append(again);
            body.append(done);
        }

        if (challenge) {
            countdown = startCountdown(CHALLENGE_SECONDS, function (remaining) {
                renderStatus(remaining);
            }, function () {
                over = true;
                finish();
            });
        }
        next();
    }

    // ---------- Make Ten (number bonds, custom tap game) ----------
    function runMakeTen(body, mode, game) {
        mode = mode || "practice";
        var challenge = mode === "challenge";
        var TARGET = 10;
        var GOAL = 8; // pairs to find to win (practice mode)
        var found = 0;
        var nums = [];
        var first = null;
        var over = false;
        var countdown = null;

        var progress = el("div", "mg-progress");
        var prompt = el("div", "mg-prompt", "Tap two cards that add up to <small>10</small>");
        var board = el("div", "mg-board");
        var feedback = el("div", "mg-feedback");
        body.append(progress, prompt, board, feedback);

        var progressText = el("span", "mg-progress-text");
        if (challenge) progress.classList.add("mg-timer");
        progress.append(progressText);

        function hasPair(list) {
            for (var i = 0; i < list.length; i++) {
                for (var j = i + 1; j < list.length; j++) {
                    if (list[i] + list[j] === TARGET) return true;
                }
            }
            return false;
        }
        function freshNumber() {
            return rand(1, 9);
        }
        function generate() {
            var list;
            do {
                list = [];
                for (var i = 0; i < 8; i++) list.push(freshNumber());
            } while (!hasPair(list));
            return list;
        }
        function refillSlots(a, b) {
            nums[a] = freshNumber();
            nums[b] = freshNumber();
            // guarantee a solvable board remains
            if (!hasPair(nums)) {
                nums[a] = freshNumber();
                nums[b] = TARGET - nums[a];
            }
        }

        function updateProgress(remaining) {
            if (challenge) {
                var time = remaining != null ? remaining : CHALLENGE_SECONDS;
                progressText.textContent = "\u23F1\uFE0F " + time + "s left  \u2022  Score: " + found;
            } else {
                progressText.textContent = "Pairs found: " + found + " of " + GOAL;
            }
        }

        function render() {
            board.innerHTML = "";
            nums.forEach(function (n, idx) {
                var t = el("button", "mg-tile", String(n));
                t.type = "button";
                t.dataset.idx = String(idx);
                t.addEventListener("click", function () {
                    onTap(idx, t);
                });
                board.append(t);
            });
        }

        function tileAt(idx) {
            return board.querySelector('[data-idx="' + idx + '"]');
        }

        function onTap(idx, tile) {
            if (over) return;
            if (tile.classList.contains("hit")) return;
            if (first === null) {
                first = idx;
                tile.classList.add("sel");
                feedback.textContent = "";
                feedback.className = "mg-feedback";
                return;
            }
            if (first === idx) {
                tile.classList.remove("sel");
                first = null;
                return;
            }
            var firstTile = tileAt(first);
            if (nums[first] + nums[idx] === TARGET) {
                firstTile.classList.remove("sel");
                firstTile.classList.add("hit");
                tile.classList.add("hit");
                playSound("correct");
                feedback.textContent = nums[first] + " + " + nums[idx] + " = 10  " + pick(PRAISE);
                feedback.className = "mg-feedback good";
                found++;
                if (challenge && countdown) {
                    countdown.addTime(1);
                    showTimeBonus(progress);
                }
                updateProgress();
                var a = first, b = idx;
                first = null;
                if (!challenge && found >= GOAL) {
                    setTimeout(win, 700);
                    return;
                }
                setTimeout(function () {
                    if (over) return;
                    refillSlots(a, b);
                    render();
                }, challenge ? 350 : 650);
            } else {
                firstTile.classList.add("miss");
                tile.classList.add("miss");
                playSound("wrong");
                feedback.textContent = "That makes " + (nums[first] + nums[idx]) + ". Try again!";
                feedback.className = "mg-feedback bad";
                var keep = first;
                first = null;
                setTimeout(function () {
                    var ft = tileAt(keep);
                    if (ft) ft.classList.remove("sel", "miss");
                    tile.classList.remove("miss");
                }, 500);
            }
        }

        function win() {
            clearActiveTimer();
            body.innerHTML = "";
            var done = el("div", "mg-done");
            done.append(
                el("div", "mg-done-emoji", "\uD83C\uDFC6"),
                el("div", "mg-done-title", "You made ten, ten times over!"),
                el("div", "mg-done-score", "You found all " + GOAL + " pairs.")
            );
            var again = el("button", "mg-btn", "Play again");
            again.type = "button";
            again.addEventListener("click", function () {
                body.innerHTML = "";
                runMakeTen(body, mode, game);
            });
            done.append(again);
            body.append(done);
        }

        function timeUp() {
            over = true;
            var replay = function () {
                body.innerHTML = "";
                runMakeTen(body, mode, game);
            };
            var scoreText =
                "You made " + found + " pairs in " + CHALLENGE_SECONDS + " seconds!";
            renderChallengeDone(body, game, found, scoreText, replay);
        }

        nums = generate();
        updateProgress();
        render();
        if (challenge) {
            countdown = startCountdown(CHALLENGE_SECONDS, function (remaining) {
                updateProgress(remaining);
            }, timeUp);
        }
    }

    // ---------- game definitions ----------
    function arrayHTML(rows, cols) {
        var html = '<div class="mg-array">';
        for (var r = 0; r < rows; r++) {
            html += '<div class="mg-array-row">';
            for (var c = 0; c < cols; c++) html += '<span class="mg-dot"></span>';
            html += "</div>";
        }
        html += "</div>";
        return html;
    }

    function skipHTML(seq, blankIndex) {
        var parts = seq.map(function (v, i) {
            return i === blankIndex ? "<b>?</b>" : String(v);
        });
        return (
            '<span style="font-size:0.9em">' +
            parts.join('<span style="opacity:.4">, </span>') +
            "</span>"
        );
    }

    // ---------- funny + tricky word problems ----------
    function escapeText(s) {
        var d = document.createElement("span");
        d.textContent = s;
        return d.innerHTML;
    }

    // Build a 4-option choice list: the answer plus three sensible (often
    // tempting) wrong answers, deduped, non-negative, shuffled.
    function buildChoices(answer, distractors) {
        var seen = {};
        seen[answer] = true;
        var out = [answer];
        distractors.forEach(function (d) {
            d = Math.round(d);
            if (d < 0 || seen[d]) return;
            seen[d] = true;
            out.push(d);
        });
        var guard = 0;
        while (out.length < 4 && guard < 100) {
            guard++;
            var d = answer + rand(-5, 6);
            if (d < 0 || seen[d]) continue;
            seen[d] = true;
            out.push(d);
        }
        return shuffle(out.slice(0, 4));
    }

    var WP_NAMES = [
        "Sir Wigglesworth", "Captain Noodle", "Princess Pickle", "Gizmo",
        "Bartholomew", "Lady Bubbles", "Sergeant Sniffles", "Waffles",
        "Professor Pancake", "Mister Snorts", "Queen Gigglepants", "Ziggy",
    ];
    var WP_ANIMALS = [
        "cat", "goat", "penguin", "llama", "hamster", "octopus", "narwhal",
        "platypus", "sloth", "raccoon", "dragon", "yak",
    ];

    // Each template returns { text, answer, distractors }. Numbers are random,
    // so a fresh problem is generated every single time.
    var WP_TEMPLATES = [
        function () {
            // Paw counting with a sneaky "+1 for the parent" twist.
            var name = pick(WP_NAMES);
            var animal = pick(WP_ANIMALS);
            var babies = rand(2, 6);
            var answer = (babies + 1) * 4;
            return {
                text:
                    name + " the " + animal + " has " + babies +
                    " babies. Every " + animal + " has 4 paws \u2014 and don't forget " +
                    name + "\u2019s own 4 paws! How many paws are there all together?",
                answer: answer,
                distractors: [babies * 4, (babies + 1) * 2, babies + 4],
            };
        },
        function () {
            // Dozens, minus a thief.
            var name = pick(WP_NAMES);
            var dozens = rand(2, 4);
            var eaten = rand(2, 9);
            var total = dozens * 12;
            var answer = total - eaten;
            return {
                text:
                    "Grandma baked " + dozens + " dozen cookies. Then " + name +
                    " the sneaky goblin gobbled up " + eaten +
                    " of them! How many cookies are left?",
                answer: answer,
                distractors: [total, 12 - eaten, dozens * 12 + eaten],
            };
        },
        function () {
            // Extra irrelevant info you must ignore.
            var red = rand(6, 15);
            var blue = rand(6, 15);
            var dogs = rand(3, 9);
            var answer = red + blue;
            return {
                text:
                    "A magic bus has " + red + " red seats and " + blue +
                    " blue seats. Outside, " + dogs +
                    " dogs are howling at the moon. How many seats are on the bus?",
                answer: answer,
                distractors: [red + blue + dogs, red + blue - dogs, dogs],
            };
        },
        function () {
            // Quarters to cents.
            var name = pick(WP_NAMES);
            var q = rand(2, 8);
            var answer = q * 25;
            return {
                text:
                    name + " found " + q +
                    " quarters stuck under the sofa cushions. How many CENTS is that? (1 quarter = 25 cents)",
                answer: answer,
                distractors: [q * 5, q * 10, q + 25],
            };
        },
        function () {
            // Split equally between 2 hands.
            var name = pick(WP_NAMES);
            var each = rand(3, 9);
            var total = each * 2;
            return {
                text:
                    name + " the alien squished " + total +
                    " slime balls and split them equally between both hands. How many slime balls in each hand?",
                answer: each,
                distractors: [total, total * 2, each + 2],
            };
        },
        function () {
            // Repeated time.
            var animal = pick(WP_ANIMALS);
            var mins = rand(2, 6);
            var count = rand(3, 6);
            var answer = mins * count;
            return {
                text:
                    "It takes " + mins + " minutes to brush one " + animal +
                    "\u2019s teeth. How many minutes to brush " + count + " " +
                    animal + "s\u2019 teeth?",
                answer: answer,
                distractors: [mins + count, mins * count + mins, mins * (count - 1)],
            };
        },
        function () {
            // Socks: how many MORE are needed.
            var name = pick(WP_NAMES);
            var legs = 8;
            var pairs = rand(1, 3);
            var has = pairs * 2;
            var answer = legs - has;
            return {
                text:
                    name + " the octopus has 8 legs and wants a sock on every leg. " +
                    "She already owns " + pairs + " pair" + (pairs > 1 ? "s" : "") +
                    " of socks. How many MORE socks does she need?",
                answer: answer,
                distractors: [legs - pairs, has, legs + has],
            };
        },
        function () {
            // Wheels on tricycles (x3) trick.
            var trikes = rand(3, 7);
            var answer = trikes * 3;
            return {
                text:
                    "At the clown parade there are " + trikes +
                    " tricycles. Each tricycle has 3 wheels. How many wheels are spinning in all?",
                answer: answer,
                distractors: [trikes * 2, trikes + 3, trikes * 4],
            };
        },
    ];

    function runPuzzle(body, mode, game) {
        runMultipleChoice(body, {
            makeQuestion: function () {
                var tmpl = pick(WP_TEMPLATES)();
                return {
                    promptHTML:
                        '<span class="mg-word">' + escapeText(tmpl.text) + "</span>",
                    answer: tmpl.answer,
                    choices: buildChoices(tmpl.answer, tmpl.distractors),
                };
            },
        }, mode, game);
    }

    var GAMES = [
        {
            id: "add",
            title: "Add It Up",
            emoji: "\u2795",
            color: "mg-c-add",
            desc: "Add the numbers and tap the answer.",
            run: function (body, mode, game) {
                runMultipleChoice(body, {
                    spread: 6,
                    makeQuestion: function () {
                        var a = rand(5, 30);
                        var b = rand(2, 20);
                        return { promptHTML: a + " + " + b, answer: a + b };
                    },
                }, mode, game);
            },
        },
        {
            id: "sub",
            title: "Take Away",
            emoji: "\u2796",
            color: "mg-c-sub",
            desc: "Subtract and tap what is left.",
            run: function (body, mode, game) {
                runMultipleChoice(body, {
                    spread: 6,
                    makeQuestion: function () {
                        var a = rand(10, 35);
                        var b = rand(1, a - 1);
                        return { promptHTML: a + " \u2212 " + b, answer: a - b };
                    },
                }, mode, game);
            },
        },
        {
            id: "ten",
            title: "Make Ten",
            emoji: "\uD83D\uDD1F",
            color: "mg-c-ten",
            desc: "Tap two cards that add up to 10.",
            run: function (body, mode, game) {
                runMakeTen(body, mode, game);
            },
        },
        {
            id: "skip",
            title: "Skip Counting",
            emoji: "\uD83D\uDC63",
            color: "mg-c-skip",
            desc: "Find the missing number in the count.",
            run: function (body, mode, game) {
                runMultipleChoice(body, {
                    spread: 0,
                    makeQuestion: function () {
                        var step = pick([2, 5, 10]);
                        var start = step * rand(1, 5);
                        var seq = [start, start + step, start + 2 * step, start + 3 * step, start + 4 * step];
                        var blank = rand(1, 3);
                        var answer = seq[blank];
                        var opts = {};
                        opts[answer] = true;
                        [answer + step, answer - step, answer + 1, answer - 1, answer + 2 * step].forEach(function (d) {
                            if (d >= 0) opts[d] = true;
                        });
                        var choiceList = Object.keys(opts).map(Number);
                        choiceList = shuffle(choiceList).slice(0, 4);
                        if (choiceList.indexOf(answer) === -1) choiceList[0] = answer;
                        return {
                            promptHTML:
                                skipHTML(seq, blank) +
                                "<small>Counting by " + step + "s</small>",
                            answer: answer,
                            choices: choiceList,
                        };
                    },
                    choices: 4,
                }, mode, game);
            },
        },
        {
            id: "times",
            title: "Times Tap",
            emoji: "\u2716\uFE0F",
            color: "mg-c-times",
            desc: "Count the dots to find the product.",
            run: function (body, mode, game) {
                runMultipleChoice(body, {
                    spread: 4,
                    makeQuestion: function () {
                        var rows = rand(2, 5);
                        var cols = rand(2, 5);
                        return {
                            promptHTML:
                                arrayHTML(rows, cols) +
                                "<small>How many dots?  " + rows + " \u00D7 " + cols + "</small>",
                            answer: rows * cols,
                        };
                    },
                }, mode, game);
            },
        },
        {
            id: "puzzle",
            title: "Puzzle",
            emoji: "\uD83E\uDDE9",
            color: "mg-c-puzzle",
            desc: "Solve a silly word problem and tap the answer.",
            run: function (body, mode, game) {
                runPuzzle(body, mode, game);
            },
        },
    ];

    // ---------- leaderboards (challenge mode) ----------
    function lbFetch(gameId) {
        return fetch("/api/scores/" + encodeURIComponent(gameId), {
            headers: { Accept: "application/json" },
        }).then(function (r) {
            if (!r.ok) throw new Error("load failed");
            return r.json();
        });
    }
    function lbQualifies(gameId, score) {
        return fetch(
            "/api/scores/" + encodeURIComponent(gameId) + "/qualifies?score=" + score,
            { headers: { Accept: "application/json" } }
        ).then(function (r) {
            if (!r.ok) throw new Error("check failed");
            return r.json();
        });
    }
    function lbSubmit(gameId, name, score) {
        return fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ game: gameId, name: name, score: score }),
        }).then(function (r) {
            return r.json().then(function (data) {
                if (!r.ok) throw new Error(data.error || "save failed");
                return data;
            });
        });
    }

    var NAME_KEY = "mg_name";
    function getSavedName() {
        try {
            return localStorage.getItem(NAME_KEY) || "";
        } catch (e) {
            return "";
        }
    }
    function saveName(name) {
        try {
            localStorage.setItem(NAME_KEY, name);
        } catch (e) {
            /* ignore */
        }
    }

    // Render a leaderboard table for one game into a container element.
    function renderLeaderboardInto(container, gameId, highlightRank) {
        container.innerHTML = "";
        container.append(el("div", "mg-lb-loading", "Loading scores\u2026"));
        lbFetch(gameId).then(function (data) {
            container.innerHTML = "";
            var board = (data && data.leaderboard) || [];
            if (!board.length) {
                container.append(
                    el("div", "mg-lb-empty",
                        "No scores yet \u2014 be the first to make the board!")
                );
                return;
            }
            var list = el("ol", "mg-lb-list");
            board.forEach(function (entry) {
                var row = el("li", "mg-lb-row");
                if (highlightRank && entry.rank === highlightRank) {
                    row.classList.add("is-you");
                }
                var medal = entry.rank === 1 ? "\uD83E\uDD47"
                    : entry.rank === 2 ? "\uD83E\uDD48"
                    : entry.rank === 3 ? "\uD83E\uDD49"
                    : entry.rank + ".";
                row.append(
                    el("span", "mg-lb-rank", medal),
                    el("span", "mg-lb-name", escapeText(entry.name)),
                    el("span", "mg-lb-score", String(entry.score))
                );
                list.append(row);
            });
            container.append(list);
        }).catch(function () {
            container.innerHTML = "";
            container.append(
                el("div", "mg-lb-empty", "Couldn't load the leaderboard. Try again later.")
            );
        });
    }

    // Full-page leaderboard view with a tab per game.
    function showLeaderboards(initialGameId) {
        clearActiveTimer();
        root.innerHTML = "";
        var stage = el("div", "mg-stage");
        var bar = el("div", "mg-stage-bar");
        var back = el("button", "mg-back", "\u2190 All games");
        back.type = "button";
        back.addEventListener("click", showGallery);
        bar.append(
            back,
            el("span", "mg-stage-title", "\uD83C\uDFC6  Leaderboards"),
            el("span", "mg-stage-mode is-challenge", "\u23F1\uFE0F Challenge")
        );
        var body = el("div", "mg-stage-body");
        var tabs = el("div", "mg-lb-tabs");
        var boardWrap = el("div", "mg-lb-board");
        body.append(tabs, boardWrap);
        stage.append(bar, body);
        root.append(stage);

        var current = initialGameId || GAMES[0].id;
        var tabButtons = {};
        GAMES.forEach(function (game) {
            var t = el("button", "mg-lb-tab", game.emoji + " " + game.title);
            t.type = "button";
            if (game.id === current) t.classList.add("active");
            t.addEventListener("click", function () {
                if (current === game.id) return;
                current = game.id;
                Object.keys(tabButtons).forEach(function (id) {
                    tabButtons[id].classList.toggle("active", id === current);
                });
                renderLeaderboardInto(boardWrap, current);
            });
            tabButtons[game.id] = t;
            tabs.append(t);
        });

        var header = document.getElementById("site-header");
        var offset = header ? header.offsetHeight + 12 : 80;
        var top = root.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: "smooth" });

        renderLeaderboardInto(boardWrap, current);
    }

    // Build the end-of-challenge screen: score, replay/leaderboard buttons, and
    // (when the score makes the top 10) a name-entry form that submits the score.
    function renderChallengeDone(body, game, score, scoreText, replay) {
        clearActiveTimer();
        body.innerHTML = "";
        var done = el("div", "mg-done");
        done.append(
            el("div", "mg-done-emoji", "\u23F1\uFE0F"),
            el("div", "mg-done-title", "Time's up!"),
            el("div", "mg-done-score", scoreText)
        );

        var formWrap = el("div", "mg-lb-formwrap");
        var boardWrap = el("div", "mg-lb-board");

        var actions = el("div", "mg-done-actions");
        var again = el("button", "mg-btn", "Play again");
        again.type = "button";
        again.addEventListener("click", replay);
        var lbBtn = el("button", "mg-btn mg-btn-ghost", "\uD83C\uDFC6 Leaderboard");
        lbBtn.type = "button";
        lbBtn.addEventListener("click", function () {
            renderLeaderboardInto(boardWrap, game.id);
        });
        actions.append(again, lbBtn);

        done.append(actions, formWrap, boardWrap);
        body.append(done);

        if (score > 0) {
            lbQualifies(game.id, score).then(function (data) {
                if (!data || !data.qualifies) return;
                buildNameForm(formWrap, boardWrap, game, score);
            }).catch(function () { /* offline: skip */ });
        }
    }

    function buildNameForm(formWrap, boardWrap, game, score) {
        formWrap.innerHTML = "";
        formWrap.append(
            el("div", "mg-lb-congrats", "\uD83C\uDF89 Top 10! Add your name to the leaderboard:")
        );
        var rowEl = el("form", "mg-lb-form");
        var input = document.createElement("input");
        input.type = "text";
        input.className = "mg-lb-input";
        input.maxLength = 24;
        input.placeholder = "Your name";
        input.value = getSavedName();
        var submit = el("button", "mg-btn", "Save score");
        submit.type = "submit";
        rowEl.append(input, submit);
        var note = el("div", "mg-lb-note");
        formWrap.append(rowEl, note);
        input.focus();

        rowEl.addEventListener("submit", function (ev) {
            ev.preventDefault();
            var name = input.value.trim() || "Anonymous";
            saveName(name);
            submit.disabled = true;
            input.disabled = true;
            submit.textContent = "Saving\u2026";
            lbSubmit(game.id, name, score).then(function (data) {
                formWrap.innerHTML = "";
                formWrap.append(
                    el("div", "mg-lb-congrats",
                        data.rank
                            ? "\uD83C\uDF1F You're #" + data.rank + " on the board!"
                            : "Saved! Here's the leaderboard:")
                );
                renderLeaderboardInto(boardWrap, game.id, data.rank);
            }).catch(function () {
                submit.disabled = false;
                input.disabled = false;
                submit.textContent = "Save score";
                note.textContent = "Couldn't save \u2014 please try again.";
                note.className = "mg-lb-note bad";
            });
        });
    }

    // ---------- gallery / stage navigation ----------
    function buildModeBar(onChange) {
        var bar = el("div", "mg-modebar");
        var current = getMode();
        var modes = [
            { id: "practice", label: "Practice", emoji: "\uD83C\uDF1F" },
            { id: "challenge", label: "Challenge", emoji: "\u23F1\uFE0F" },
        ];
        var buttons = {};
        modes.forEach(function (m) {
            var b = el("button", "mg-mode-btn", m.emoji + " " + m.label);
            b.type = "button";
            if (m.id === current) b.classList.add("active");
            b.addEventListener("click", function () {
                if (getMode() === m.id) return;
                setMode(m.id);
                modes.forEach(function (mm) {
                    buttons[mm.id].classList.toggle("active", mm.id === m.id);
                });
                if (onChange) onChange(m.id);
            });
            buttons[m.id] = b;
            bar.append(b);
        });
        return bar;
    }

    function showGallery() {
        clearActiveTimer();
        root.innerHTML = "";
        var top = el("div", "mg-toolbar");
        var hint = el("span", "mg-mode-hint",
            getMode() === "challenge"
                ? "Race the clock \u2014 30 seconds, unlimited questions!"
                : "Take your time \u2014 no clock, just practice.");
        var modebar = buildModeBar(function (m) {
            hint.textContent = m === "challenge"
                ? "Race the clock \u2014 30 seconds, unlimited questions!"
                : "Take your time \u2014 no clock, just practice.";
        });
        var lbButton = el("button", "mg-lb-open", "\uD83C\uDFC6 Leaderboards");
        lbButton.type = "button";
        lbButton.setAttribute("aria-label", "View leaderboards");
        lbButton.addEventListener("click", function () {
            showLeaderboards();
        });
        var controls = el("div", "mg-controls");
        controls.append(modebar, lbButton);
        top.append(hint, controls);
        root.append(top);

        var gallery = el("div", "mg-gallery");
        GAMES.forEach(function (game) {
            var card = el("button", "mg-card " + game.color);
            card.type = "button";
            card.setAttribute("aria-label", "Play " + game.title);
            card.append(
                el("span", "mg-card-emoji", game.emoji),
                el("span", "mg-card-title", game.title),
                el("span", "mg-card-desc", game.desc),
                el("span", "mg-card-play", "Tap to play \u2192")
            );
            card.addEventListener("click", function () {
                showGame(game);
            });
            gallery.append(card);
        });
        root.append(gallery);
    }

    function showGame(game) {
        clearActiveTimer();
        var mode = getMode();
        root.innerHTML = "";
        var stage = el("div", "mg-stage");
        var bar = el("div", "mg-stage-bar");
        var back = el("button", "mg-back", "\u2190 All games");
        back.type = "button";
        back.addEventListener("click", showGallery);
        var badge = el("span", "mg-stage-mode " + (mode === "challenge" ? "is-challenge" : "is-practice"),
            mode === "challenge" ? "\u23F1\uFE0F Challenge" : "\uD83C\uDF1F Practice");
        bar.append(back, el("span", "mg-stage-title", game.emoji + "  " + game.title), badge);
        var stageBody = el("div", "mg-stage-body");
        stage.append(bar, stageBody);
        root.append(stage);

        var header = document.getElementById("site-header");
        var offset = header ? header.offsetHeight + 12 : 80;
        var top = root.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: "smooth" });

        game.run(stageBody, mode, game);
    }

    showGallery();
})();
