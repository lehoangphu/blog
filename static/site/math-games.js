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

    var PRAISE = ["Nice!", "Great job!", "You got it!", "Awesome!", "Way to go!", "Correct!"];
    var ROUNDS = 10;

    // ---------- shared multiple-choice engine ----------
    // config: { makeQuestion() -> {promptHTML, answer}, spread, choices }
    function runMultipleChoice(body, config) {
        var spread = config.spread || 6;
        var choiceCount = config.choices || 4;
        var score = 0;
        var round = 0;
        var firstTry = true;

        var progress = el("div", "mg-progress");
        var stars = el("div", "mg-stars");
        var prompt = el("div", "mg-prompt");
        var choices = el("div", "mg-choices");
        var feedback = el("div", "mg-feedback");
        body.append(progress, stars, prompt, choices, feedback);

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

        function renderStars() {
            stars.textContent = score > 0 ? Array(score + 1).join("\u2B50") : "";
        }

        function next() {
            if (round >= ROUNDS) return finish();
            round++;
            firstTry = true;
            progress.textContent = "Question " + round + " of " + ROUNDS;
            renderStars();
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
                    if (b.disabled) return;
                    if (val === q.answer) {
                        b.classList.add("correct");
                        Array.prototype.forEach.call(choices.children, function (c) {
                            c.disabled = true;
                        });
                        if (firstTry) score++;
                        feedback.textContent = pick(PRAISE);
                        feedback.classList.add("good");
                        renderStars();
                        setTimeout(next, 850);
                    } else {
                        firstTry = false;
                        b.classList.add("wrong");
                        b.disabled = true;
                        feedback.textContent = "Try again!";
                        feedback.className = "mg-feedback bad";
                    }
                });
                choices.append(b);
            });
        }

        function finish() {
            body.innerHTML = "";
            var done = el("div", "mg-done");
            done.append(
                el("div", "mg-done-emoji", score >= 8 ? "\uD83C\uDFC6" : "\uD83C\uDF89"),
                el("div", "mg-done-title", "All done!"),
                el("div", "mg-done-score", "You earned " + score + " of " + ROUNDS + " stars on the first try.")
            );
            var again = el("button", "mg-btn", "Play again");
            again.type = "button";
            again.addEventListener("click", function () {
                body.innerHTML = "";
                runMultipleChoice(body, config);
            });
            done.append(again);
            body.append(done);
        }

        next();
    }

    // ---------- Make Ten (number bonds, custom tap game) ----------
    function runMakeTen(body) {
        var TARGET = 10;
        var GOAL = 8; // pairs to find to win
        var found = 0;
        var nums = [];
        var first = null;

        var progress = el("div", "mg-progress");
        var prompt = el("div", "mg-prompt", "Tap two cards that add up to <small>10</small>");
        var board = el("div", "mg-board");
        var feedback = el("div", "mg-feedback");
        body.append(progress, prompt, board, feedback);

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

        function updateProgress() {
            progress.textContent = "Pairs found: " + found + " of " + GOAL;
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
                feedback.textContent = nums[first] + " + " + nums[idx] + " = 10  " + pick(PRAISE);
                feedback.className = "mg-feedback good";
                found++;
                updateProgress();
                var a = first, b = idx;
                first = null;
                if (found >= GOAL) {
                    setTimeout(win, 700);
                    return;
                }
                setTimeout(function () {
                    refillSlots(a, b);
                    render();
                }, 650);
            } else {
                firstTile.classList.add("miss");
                tile.classList.add("miss");
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
                runMakeTen(body);
            });
            done.append(again);
            body.append(done);
        }

        nums = generate();
        updateProgress();
        render();
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

    var GAMES = [
        {
            id: "add",
            title: "Add It Up",
            emoji: "\u2795",
            color: "mg-c-add",
            desc: "Add the numbers and tap the answer.",
            run: function (body) {
                runMultipleChoice(body, {
                    spread: 6,
                    makeQuestion: function () {
                        var a = rand(5, 30);
                        var b = rand(2, 20);
                        return { promptHTML: a + " + " + b, answer: a + b };
                    },
                });
            },
        },
        {
            id: "sub",
            title: "Take Away",
            emoji: "\u2796",
            color: "mg-c-sub",
            desc: "Subtract and tap what is left.",
            run: function (body) {
                runMultipleChoice(body, {
                    spread: 6,
                    makeQuestion: function () {
                        var a = rand(10, 35);
                        var b = rand(1, a - 1);
                        return { promptHTML: a + " \u2212 " + b, answer: a - b };
                    },
                });
            },
        },
        {
            id: "ten",
            title: "Make Ten",
            emoji: "\uD83D\uDD1F",
            color: "mg-c-ten",
            desc: "Tap two cards that add up to 10.",
            run: function (body) {
                runMakeTen(body);
            },
        },
        {
            id: "skip",
            title: "Skip Counting",
            emoji: "\uD83D\uDC63",
            color: "mg-c-skip",
            desc: "Find the missing number in the count.",
            run: function (body) {
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
                });
            },
        },
        {
            id: "times",
            title: "Times Tap",
            emoji: "\u2716\uFE0F",
            color: "mg-c-times",
            desc: "Count the dots to find the product.",
            run: function (body) {
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
                });
            },
        },
    ];

    // ---------- gallery / stage navigation ----------
    function showGallery() {
        root.innerHTML = "";
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
        root.innerHTML = "";
        var stage = el("div", "mg-stage");
        var bar = el("div", "mg-stage-bar");
        var back = el("button", "mg-back", "\u2190 All games");
        back.type = "button";
        back.addEventListener("click", showGallery);
        bar.append(back, el("span", "mg-stage-title", game.emoji + "  " + game.title));
        var stageBody = el("div", "mg-stage-body");
        stage.append(bar, stageBody);
        root.append(stage);

        var header = document.getElementById("site-header");
        var offset = header ? header.offsetHeight + 12 : 80;
        var top = root.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: "smooth" });

        game.run(stageBody);
    }

    showGallery();
})();
