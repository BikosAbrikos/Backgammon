# Backgammon Pro

> A production-grade multiplayer backgammon platform with real-time ranked play, a three-tier AI engine, and two original game modes — **Spy** and **Quantum** — that fundamentally reimagine what the 5,000-year-old game can be.

**Live demo:** [backgammon-pro.vercel.app](https://backgammon-pro.vercel.app)  
**Repository:** [github.com/BikosAbrikos/Backgammon](https://github.com/BikosAbrikos/Backgammon)

---

## What Was Built

This is not a port of a physical game. Every layer — game engine, multiplayer server, AI, matchmaking, and all UI — was designed and written from scratch.

The core achievement is architectural: the same backgammon rule engine was implemented in **both Python and TypeScript** so that online games are server-authoritative (preventing cheating) while offline/bot games run entirely in the browser with zero latency. The two implementations stay in sync and share the same rule logic.

On top of that foundation, two entirely original game modes were designed from first principles: one that adds **deception and psychology** to the game, and one that introduces **quantum superposition** as a core mechanic.

---

## Feature Overview

| Category | What's included |
|---|---|
| **Game modes** | Short (Western), Long, Local 2-player, Bot, Online Ranked, Private Room, Spy, Quantum |
| **Multiplayer** | Real-time WebSocket gameplay, ELO matchmaking, reconnection handling |
| **AI** | 3 difficulty levels with distinct decision algorithms |
| **Accounts** | JWT auth, ELO rating, win streaks, match history, 8 avatars |
| **Social** | Friend requests, private invite rooms (6-char code) |
| **UI/UX** | Board flip for black player, pip count display, opponent-turn overlay, resign flow |

---

## Technical Architecture

### Dual Engine Design

The game engine exists twice: once in Python (backend) and once in TypeScript (frontend). They are kept structurally identical and cover identical rule logic:

```
backend/app/engine/          frontend/src/engine/
  state.py    ←──────────→     (types in gameStore.ts)
  rules.py    ←──────────→     rules.ts
  moves.py    ←──────────→     moves.ts
  dice.py     ←──────────→     dice.ts
  setup.py    ←──────────→     (initial state in gameStore)
```

- **Online games** — every move is validated server-side before being applied. The client applies moves locally (batch model) and the server confirms; if the server rejects a move, the client state rolls back. This prevents any client-side manipulation.
- **Offline/bot games** — the TypeScript engine runs entirely in the browser. No round-trip to the server means zero input latency and full offline playability.

### WebSocket Protocol

Two WebSocket endpoints handle all real-time communication:

- `/ws/matchmaking` — queue management, ELO-based matching (window starts at ±150, expands ±50 every 15 s, caps at ±600)
- `/ws/game/{room_id}` — authenticated game session with typed message protocol

**Batch move model:** When playing online (short/long modes), the client applies all moves for a turn locally and sends them as a single `batch_moves` packet when the turn ends. The opponent sees only the completed turn — not each individual move — eliminating mid-turn state flicker and halving round-trip overhead.

### AI Engine

The three bot levels use genuinely different algorithms, not just different speeds:

| Level | Algorithm |
|---|---|
| Beginner | Uniform random selection among legal moves |
| Medium | Per-move heuristic scoring: +4 bear off, +5 hit blot, +3 make point, −3 expose blot |
| Advanced | Full board state evaluation: pip count delta, prime length, blot exposure count, home board occupation score |

Bot difficulty also affects Spy mode behaviour: the advanced bot calibrates challenge probability based on move legality patterns, while the beginner bot challenges at random.

### Stack

**Backend:** Python · FastAPI · async SQLAlchemy · asyncpg (PostgreSQL) / aiosqlite (dev) · python-jose (JWT) · bcrypt  
**Frontend:** React 19 · TypeScript · Vite · Zustand · React Router 7 · Tailwind CSS 4 · Axios

---

## Spy Mode

> *Did they just cheat? Or was that legal?*

Spy Mode is an original game mechanic that injects **psychological deception** into backgammon.

### The Rules

Each player begins with **3 Spy Tokens**. Spending a token lets you make an **illegal move** — placing any piece anywhere on the board, ignoring dice values, direction, and blocking rules entirely.

After *every* move — legal or not — a **7-second challenge window** opens:

| Scenario | Outcome |
|---|---|
| Illegal move, opponent challenges | **Caught** — piece returns to bar, token consumed, turn forfeited |
| Legal move, opponent challenges | **Missed** — challenge fails, the move stands, game continues |
| Any move, no challenge in 7 s | **Timeout** — move stands unconditionally |

### Why It Works

The mechanic exploits the fundamental asymmetry of information. Once Spy Mode is active, **every move becomes suspicious** — including completely normal ones. The opponent faces a decision on every single turn: challenge or let it pass?

- Challenge too often → waste time and create psychological pressure that can backfire on legal moves
- Never challenge → opponent freely exploits all three tokens at decisive moments

The real game becomes one of **behavioral reading**. Players must manage their token usage to stay unpredictable, decide whether to "burn" a token on a low-stakes position to build credibility for a later bluff, and read whether the opponent is over-challenging or sleeping. It turns backgammon — historically a perfect-information game — into something resembling poker, where the board state matters less than what your opponent thinks you believe.

---

## Quantum Mode

> *Your position exists in superposition — until the universe collapses.*

Quantum Mode is an original mechanic inspired by quantum superposition: the principle that a particle can exist in multiple states simultaneously until it is observed.

### The Mechanic

When the quantum player rolls the dice, their turn **branches into two parallel realities**:

```
Roll dice
    │
    ├─── Branch A: player makes first half of moves normally
    │         (captured and frozen as Branch A position)
    │
    └─── Branch B: player makes second half of moves normally
              (captured and frozen as Branch B position)
```

The opponent then plays their turn on the **pre-branch board** — the board as it was before either branch existed. They can see both branch positions rendered as ghost overlays (cyan = Branch A, orange = Branch B), but the actual board is still the pre-branch state.

When the quantum player's **next turn** arrives, the universe collapses:

```
Quantum player rolls
    │
    ├─── 50% → Branch A survives, Branch B is erased
    └─── 50% → Branch B survives, Branch A is erased

If collapsed pieces overlap a lone opponent checker → Quantum Hit (piece to bar)
```

### Why It Changes Everything

Standard backgammon has **perfect information** — both players always know exactly where every piece is. Quantum Mode eliminates that guarantee for one player's pieces each turn.

The consequences cascade:

- **The quantum player** must construct two strategically coherent plans from the same dice roll simultaneously. Both branches need to be defensible, because either one could become reality.
- **The opponent** must decide whether to play aggressively or defensively against a board position that will change unpredictably. Blocking one branch might leave the other branch free. Attacking might expose you to a quantum hit.
- **Quantum hits** can remove pieces that were "safe" — pieces the opponent placed after seeing branch A, which then get hit by branch B's collapse.

The result is a game where committing too early is punished. The strongest players are those who can **hold two independent strategies in parallel** and adapt the moment the collapse is revealed.

---

## Why This Project Stands Out

### Technical originality
The dual-engine architecture (identical rule logic in two languages, server-authoritative for online, client-side for offline) is not a common approach for browser games. It was chosen specifically to solve the anti-cheat problem without sacrificing the responsiveness of local play.

### Game design originality
Spy Mode and Quantum Mode are not modifications of existing backgammon variants. They were designed from first principles to introduce new strategic dimensions — deception and probabilistic futures — that are impossible to implement on a physical board. Both modes have full AI support, complete online multiplayer implementations, and their own UI systems.

### Production completeness
This is not a prototype. It includes ELO-rated competitive play, persistent accounts, match history, a friend system, private rooms, reconnection handling, a three-tier AI, and a full mobile-responsive UI. Every component was built by hand.

### Scope
Eight distinct game modes. Two original game designs. A complete competitive platform. A custom rule engine in two languages. A three-algorithm AI. All of it in one project.

---

## Running Locally

**Prerequisites:** Python 3.11+, Node.js 18+

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
The backend starts on `http://localhost:8000`. SQLite is used automatically when no `DATABASE_URL` is set.

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
The frontend starts on `http://localhost:5173` and connects to the backend automatically.

**Environment variables (optional)**
```env
# frontend/.env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## Project Structure

```
backend/
└── app/
    ├── engine/        # Core game logic: rules, moves, dice, board setup
    ├── ws/            # WebSocket layer: matchmaking queue + live game handler
    ├── auth/          # JWT authentication, bcrypt password hashing
    ├── users/         # Profiles, ELO, leaderboard, game history
    ├── friends/       # Friend request system
    ├── rooms/         # Private room creation and joining
    ├── models.py      # SQLAlchemy ORM (User, Game, Friend, Room)
    └── main.py        # FastAPI app entry point

frontend/
└── src/
    ├── engine/        # TypeScript game engine (mirrors Python engine)
    ├── store/         # Zustand state management (auth + game)
    ├── pages/         # Full-page route components
    └── components/    # Board, Checkers, Dice, Triangles, UI primitives
```

---

## License

MIT
