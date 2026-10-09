#!/usr/bin/env node
// Community Chess engine for roycrisses profile README.
// Commands: render | readme | sync | move
//   render: chess.json -> board.svg
//   readme: chess.json -> README.md chess block
//   sync:   render + readme
//   move:   validate + apply one UCI move from a GitHub issue title
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Chess } from "chess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "roycrisses/roycrisses";
const OWNER = "roycrisses";
const STATE_PATH = join(__dirname, "..", "chess.json");
const BOARD_PATH = join(__dirname, "..", "board.svg");
const README_PATH = join(__dirname, "..", "README.md");
const GAMES_DIR = join(__dirname, "..", "games");

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function fenHash(fen) {
  return createHash("sha256").update(fen).digest("hex").slice(0, 8);
}

function loadState() {
  const raw = readFileSync(STATE_PATH, "utf8");
  return JSON.parse(raw);
}

function saveState(s) {
  s.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + "\n");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}

// ---------- board rendering ----------
const PIECES = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

function renderBoardSVG(fen, lastMove, inCheck) {
  const sq = 60;
  const margin = 24;
  const size = sq * 8 + margin;
  const light = "#F0D9B5";
  const dark = "#B58863";
  const hlLight = "#F7F769";
  const hlDark = "#DCC34A";
  const checkHl = "#E86A6A";

  const chess = new Chess(fen);
  const b = chess.board(); // rank 8 -> rank 1
  const hl = new Set();
  if (lastMove) {
    hl.add(lastMove.from);
    hl.add(lastMove.to);
  }

  const sqName = (r, c) => "abcdefgh"[c] + (8 - r);
  let rects = "";
  let labels = "";
  let pieces = "";

  // find king in check to highlight
  let kingSq = null;
  if (inCheck) {
    const turn = chess.turn(); // side to move is in check
    outer: for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = b[r][c];
        if (cell && cell.type === "k" && cell.color === turn) {
          kingSq = sqName(r, c);
          break outer;
        }
      }
    }
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const name = sqName(r, c);
      const isLight = (r + c) % 2 === 0;
      let fill = isLight ? light : dark;
      if (hl.has(name)) fill = isLight ? hlLight : hlDark;
      if (kingSq === name) fill = checkHl;
      const x = margin + c * sq;
      const y = r * sq;
      rects += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="${fill}"/>`;
      const cell = b[r][c];
      if (cell) {
        const glyph = PIECES[cell.type];
        const cx = x + sq / 2;
        const cy = y + sq / 2 + 2;
        if (cell.color === "w") {
          pieces += `<text x="${cx}" y="${cy}" font-size="42" text-anchor="middle" dominant-baseline="central" fill="#ffffff" stroke="#1a1a1a" stroke-width="1.4" font-family="Segoe UI Symbol,Noto Sans Symbols 2,DejaVu Sans,serif">${glyph}</text>`;
        } else {
          pieces += `<text x="${cx}" y="${cy}" font-size="42" text-anchor="middle" dominant-baseline="central" fill="#1a1a1a" font-family="Segoe UI Symbol,Noto Sans Symbols 2,DejaVu Sans,serif">${glyph}</text>`;
        }
      }
      // coordinates: files on bottom rank, ranks on left file
      if (r === 7) {
        const fc = isLight ? dark : light;
        labels += `<text x="${x + 4}" y="${y + sq - 5}" font-size="12" font-family="monospace" fill="${fc}" opacity="0.9">${"abcdefgh"[c]}</text>`;
      }
      if (c === 0) {
        const fc = isLight ? dark : light;
        labels += `<text x="${x + 4}" y="${y + 15}" font-size="12" font-family="monospace" fill="${fc}" opacity="0.9">${8 - r}</text>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Chess board">
<rect x="0" y="0" width="${size}" height="${size}" rx="10" fill="#1a1a2e"/>
<rect x="${margin}" y="0" width="${sq * 8}" height="${sq * 8}" fill="${light}"/>
${rects}${pieces}${labels}
</svg>
`;
}

function gameStatus(chess) {
  if (chess.isCheckmate()) return { over: true, result: chess.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (chess.isStalemate()) return { over: true, result: "1/2-1/2", reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { over: true, result: "1/2-1/2", reason: "insufficient material" };
  if (chess.isThreefoldRepetition()) return { over: true, result: "1/2-1/2", reason: "threefold repetition" };
  if (chess.isDraw()) return { over: true, result: "1/2-1/2", reason: "draw (50-move rule)" };
  return { over: false, result: null, reason: chess.isCheck() ? "check" : null };
}

// ---------- README block ----------
function moveIssueURL(uci, hash, gameId) {
  const title = `chess|${uci}|${hash}|g${gameId}`;
  const body = [
    `Move: ${uci}`,
    `Game: ${gameId}`,
    ``,
    `This issue was created from the profile README chess board.`,
    `The bot validates legality + turn order and updates the board automatically.`,
    `Please don't edit the title — it encodes the move.`,
  ].join("\n");
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function buildChessSection(state) {
  const chess = new Chess(state.fen);
  const hash = fenHash(state.fen);
  const turn = chess.turn();
  const st = gameStatus(chess);
  const legal = chess.moves({ verbose: true });
  const turnLabel = turn === "w" ? "⚪ White to move — Visitors" : "⚫ Black to move — Krishna (@roycrisses)";
  const checkLabel = st.reason === "check" ? " — **CHECK!**" : "";

  const last = state.lastMove ? `Last move: \`${state.lastMove.san}\` by @${state.lastMove.by}` : "Last move: — (new game)";
  const resultLine = state.lastResult ? `> ${state.lastResult}\n\n` : "";

  // Group legal moves by piece for compact display (cap 60 to avoid README bloat)
  const shown = legal.slice(0, 60);
  const links = shown
    .map((m) => {
      const uci = m.from + m.to + (m.promotion ? m.promotion : "");
      const label = m.san.replace(/[+#?!]+$/, "");
      return `[${label}](${moveIssueURL(uci, hash, state.gameId)})`;
    })
    .join(" · ");

  const more = legal.length > shown.length ? `\n\n*…and ${legal.length - shown.length} more legal moves — open the board issue template to type any UCI.*` : "";

  const topPlayers = Object.entries(state.stats.players || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([u, n], i) => `${i + 1}. @${u} — ${n} move${n === 1 ? "" : "s"}`)
    .join("\n");
  const leaderboard = topPlayers ? `\n\n**Top visitors**\n\n${topPlayers}\n` : "";

  const pgnShort = state.pgn ? state.pgn.slice(-300) : "—";

  return `<!-- CHESS-START -->
## ♟️ Community Chess — play me right here

<div align="center">

**Game #${state.gameId} · ${turnLabel}${checkLabel}**

${resultLine}${last} · Moves played: ${state.stats.totalMoves}

<img src="./board.svg" width="480" alt="Community chess board — Game ${state.gameId}"/>

*Click a move below to play it (opens a pre-filled Issue → bot validates legality + turn, board refreshes in ~30s). You must be logged into GitHub to move.*

${links}${more}

</div>

<details>
<summary>📜 PGN + rules (click to expand)</summary>

- **Visitors = White, Krishna = Black.** White moves first. Visitors move only on White's turn, Krishna only on Black's turn.
- Only **legal chess moves** are accepted (castling, en passant, promotion, check rules enforced by \`chess.js\`).
- Promotion defaults to queen — underpromotion links appear automatically when available (e.g. \`e7e8=n\`).
- First valid move wins; stale/duplicate/issues with edited titles are rejected with a comment.
- Checkmate / stalemate / draw auto-archives the PGN to \`games/\` and starts the next game.

Recent PGN: \`${pgnShort}\`

[Move history](https://github.com/${REPO}/issues?q=label%3Achess-move+is%3Aissue) · [All games](./games/)
${leaderboard}
</details>

<!-- CHESS-END -->`;
}

function updateReadme(section) {
  let md = readFileSync(README_PATH, "utf8");
  if (md.includes("<!-- CHESS-START -->") && md.includes("<!-- CHESS-END -->")) {
    const re = /<!-- CHESS-START -->[\s\S]*?<!-- CHESS-END -->/;
    md = md.replace(re, section);
  } else {
    // Insert after floating-PC block, else append near top
    const anchor = "Click the PC to boot KarkiOS";
    const idx = md.indexOf(anchor);
    if (idx !== -1) {
      const endDiv = md.indexOf("</div>", idx);
      md = md.slice(0, endDiv + 6) + "\n\n---\n\n" + section + md.slice(endDiv + 6);
    } else {
      md = section + "\n\n---\n\n" + md;
    }
  }
  writeFileSync(README_PATH, md);
}

function doRender(state) {
  const chess = new Chess(state.fen);
  const st = gameStatus(chess);
  const svg = renderBoardSVG(state.fen, state.lastMove, st.reason === "check");
  writeFileSync(BOARD_PATH, svg);
}

function doReadme(state) {
  updateReadme(buildChessSection(state));
}

function applyMoveUCI(chess, uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  let promotion = uci.slice(4, 5) || undefined;
  // default promotion to queen when required but unspecified
  const verbose = chess.moves({ verbose: true });
  const needsPromo = verbose.some((m) => m.from === from && m.to === to && m.promotion);
  if (needsPromo && !promotion) promotion = "q";
  if (promotion && !["q", "r", "b", "n"].includes(promotion)) return null;
  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}

function cmdMove(args) {
  const title = args["issue-title"] || "";
  const actor = (args["issue-user"] || "").toLowerCase();
  const parts = title.split("|");
  const out = { ok: false, reason: "", message: "", move: null };

  if (parts[0] !== "chess" || !parts[1]) {
    out.reason = "not-chess";
    out.message = "Not a chess move issue — ignoring.";
    console.log(JSON.stringify(out));
    return out;
  }
  const uci = parts[1].toLowerCase().trim();
  const hash = parts[2] || "";
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    out.reason = "bad-format";
    out.message = `Invalid move format \`${uci}\`. Use UCI like \`e2e4\` (promotion: \`e7e8q\`). No board change.`;
    console.log(JSON.stringify(out));
    return out;
  }

  const state = loadState();
  const chess = new Chess(state.fen);
  const currentHash = fenHash(state.fen);
  if (hash && hash !== currentHash) {
    out.reason = "stale";
    out.message = `Stale board — the game moved since you clicked. Current FEN hash is \`${currentHash}\`, your link had \`${hash}\`. Please go back to the profile and click a fresh move.`;
    console.log(JSON.stringify(out));
    return out;
  }

  const turn = chess.turn();
  const isOwner = actor === OWNER;
  if (turn === "w" && isOwner) {
    out.reason = "out-of-turn";
    out.message = `It's **Visitors' (White) turn** — @${OWNER} plays Black only. Visitors, click a move from the README!`;
    console.log(JSON.stringify(out));
    return out;
  }
  if (turn === "b" && !isOwner) {
    out.reason = "out-of-turn";
    out.message = `It's **Krishna's (Black) turn** — waiting for @${OWNER}. Your move \`${uci}\` was not applied. Watch the board!`;
    console.log(JSON.stringify(out));
    return out;
  }

  const mv = applyMoveUCI(chess, uci);
  if (!mv) {
    const legalSample = chess.moves().slice(0, 12).join(", ");
    out.reason = "illegal";
    out.message = `Illegal move \`${uci}\` in current position. Legal examples: ${legalSample}. No board change.`;
    console.log(JSON.stringify(out));
    return out;
  }

  // success — update state
  state.fen = chess.fen();
  state.pgn = chess.pgn();
  state.turn = chess.turn();
  state.lastMove = { from: mv.from, to: mv.to, san: mv.san, by: args["issue-user"] || "unknown", at: new Date().toISOString() };
  state.stats.totalMoves += 1;
  if (!isOwner) {
    const u = args["issue-user"] || "unknown";
    state.stats.players[u] = (state.stats.players[u] || 0) + 1;
  }

  const st = gameStatus(chess);
  if (st.over) {
    // archive + reset
    try {
      mkdirSync(GAMES_DIR, { recursive: true });
      const name = `game-${state.gameId}-${st.result.replace(/\//g, "-")}.pgn`;
      const header = `[Event "roycrisses profile chess #${state.gameId}"]\n[Result "${st.result}"]\n\n`;
      writeFileSync(join(GAMES_DIR, name), header + chess.pgn() + "\n");
    } catch {}
    const winner = st.result === "1-0" ? "Visitors (White) win 🎉" : st.result === "0-1" ? "Krishna (Black) wins ♟️" : "Drawn 🤝";
    if (st.result === "1-0") state.stats.whiteWins += 1;
    else if (st.result === "0-1") state.stats.blackWins += 1;
    else state.stats.draws += 1;
    state.lastResult = `Game #${state.gameId} over — **${winner}** (${st.reason}, ${st.result}). Final: \`${mv.san}\`. New game started below!`;
    state.gameId += 1;
    const fresh = new Chess();
    state.fen = fresh.fen();
    state.pgn = "";
    state.turn = "w";
    state.lastMove = null;
  } else if (st.reason === "check") {
    state.lastResult = null;
  } else {
    if (state.lastResult && state.lastResult.startsWith("Game #")) state.lastResult = null; // clear old game banner after one move
  }

  saveState(state);
  doRender(state);
  doReadme(state);

  out.ok = true;
  out.reason = "applied";
  out.move = mv.san;
  out.message = st.over
    ? `✅ \`${uci}\` played as **${mv.san}** — game over (${st.reason}, ${st.result}). Board reset for Game #${state.gameId}!`
    : `✅ \`${uci}\` played as **${mv.san}**. Board updated — ${chess.turn() === "w" ? "Visitors (White)" : "Krishna (Black)"} to move.`;
  console.log(JSON.stringify(out));
  return out;
}

const cmd = process.argv[2] || "sync";
const args = parseArgs(process.argv.slice(3));

if (cmd === "render") {
  doRender(loadState());
} else if (cmd === "readme") {
  doReadme(loadState());
} else if (cmd === "sync") {
  const s = loadState();
  doRender(s);
  doReadme(s);
  console.log("synced board.svg + README chess block");
} else if (cmd === "move") {
  cmdMove(args);
} else if (cmd === "hash") {
  console.log(fenHash(loadState().fen));
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
