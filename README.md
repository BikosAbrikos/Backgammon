# Backgammon Pro

A full-stack multiplayer backgammon platform built from scratch — featuring real-time ranked play, three-tier AI opponents, and two completely original game modes that don't exist anywhere else: **Spy** and **Quantum**.

---

## What is this?

Backgammon Pro is an online backgammon game with everything you'd expect from a serious platform — ELO rankings, player profiles, friend system, private rooms — plus two experimental modes that reimagine what backgammon can be. The entire game engine was written from scratch in both Python (server-authoritative for online play) and TypeScript (client-side for local/bot games).

**Tech stack:** FastAPI · WebSockets · React 19 · TypeScript · Zustand · Tailwind CSS · PostgreSQL · JWT auth

---

## Game Modes

### Classic Modes

**Short (Western Rules)**
Standard backgammon. Land on a lone opponent checker and send it to the bar. First to bear off all 15 pieces wins.

**Long**
A single checker is enough to block a point — no hitting. Slower, more positional, forces you to think several moves ahead before committing.

**Local 2P**
Pass-and-play on the same device. No account required.

**Bot**
Three difficulty levels:
- *Beginner* — plays random legal moves
- *Medium* — scores each move by heuristics (bearing off, hitting blots, building points)
- *Advanced* — full board evaluation: pip count, prime formation, blot exposure, home-board strength

**Online / Ranked**
WebSocket matchmaking with ELO rating. The system matches you by skill level and expands the search window over time so you never wait too long. Results are saved, ELO is updated, and win streaks are tracked.

**Private Room**
Generate a 6-character invite code and share it with anyone. The room is yours for 15 minutes — after both players connect, the game is live.

---

## Spy Mode

> *"Did they just cheat? Or was that legal?"*

Every player starts each game with **3 Spy Tokens**. At any point during your turn, you can spend a token to make an **illegal move** — moving a piece anywhere on the board regardless of dice values, direction, or blocking rules.

After every single move (legal or not), a **7-second challenge window** opens for the opponent.

| Outcome | What happened |
|---|---|
| **Caught** | The move was illegal — piece goes back to your bar, you lose a token, your turn ends |
| **Missed** | The move was actually legal — challenge fails, opponent looks foolish, game continues |
| **Timeout** | Opponent doesn't challenge in time — the move stands, no questions asked |

**Why it works as a game mode:**

The brilliance of Spy mode is pure psychology. Even a completely standard, by-the-rules move now carries a question mark over it. Your opponent has to decide: *is this a cheat or not?* Challenge too often and you drain your turns second-guessing legal plays. Never challenge and your opponent will exploit every token they have. The meta-game of reading your opponent's behavior — and controlling how yours appears — adds a layer of deception that turns backgammon into something closer to poker.

Tokens are finite. Use them wisely. Save them for the moment that actually matters.

---

## Quantum Mode

> *"Your position is in superposition — until the universe decides."*

Quantum mode is inspired by the thought experiment of a particle existing in two states simultaneously until observed.

**How it works:**

When you roll the dice, instead of making a single sequence of moves, you play across **two simultaneous branches of reality**:

- **Branch A** — your first half of moves, played normally
- **Branch B** — the second half of moves, played normally

Both branches are captured and frozen. Your opponent then takes their turn on a *pre-branch* board — they see ghost overlays of both possible positions (cyan for Branch A, orange for Branch B) but can't be sure which reality they're in.

When your next turn comes around, the universe **collapses** — one branch is selected at random, 50/50. Your pieces snap to that position. The other branch vanishes as if it never happened.

**The twist:** If your collapsed pieces land on a point where the opponent has a single checker, it gets sent to the bar — even though that "version" of you never made that move while they were watching.

**Why it changes everything:**

Standard backgammon is a perfect information game — both players always know the exact board state. Quantum mode shatters that. You have to plan not for one board position but for two futures at once, and your opponent has to defend against both. Knowing a collapse is coming in two turns but not knowing *which* branch survives forces a completely different kind of positional thinking. Aggressive or defensive? Block now or leave yourself flexible? The right answer depends on which universe you end up in.

It rewards players who can hold multiple strategic plans in parallel and punishes those who commit too early.

---

## Why Play This Instead of Other Backgammon Apps?

Most digital backgammon games are ports — they take the physical game and put it on a screen. This project was built with the question: *what can backgammon become when you remove the constraints of a physical board?*

**The original modes are genuinely new.** Spy and Quantum don't exist as implemented features anywhere else. They're not gimmicks — they're full game modes with consistent rulesets, working online multiplayer, and AI support.

**The AI actually plays differently by level.** Beginner, Medium, and Advanced aren't just speed adjustments — they use fundamentally different decision logic. Playing against Advanced will teach you real backgammon concepts.

**It's built for competitive play.** ELO ranking, match history, win streaks, friend system, private rooms — everything you'd expect from a platform, not a demo.

**No pay walls, no timers, no ads.** Open source. Just backgammon.

---

## Running Locally

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in `frontend/.env` to your backend URL. By default both run on localhost and connect automatically.

---

## Project Structure

```
backend/
  app/
    engine/       # Game rules, move validation, dice, board setup
    ws/           # WebSocket handlers — matchmaking + live game
    auth/         # JWT authentication
    users/        # Profiles, ELO, game history
    friends/      # Friend requests
    rooms/        # Private room creation

frontend/
  src/
    engine/       # TypeScript mirror of the Python engine (offline/bot play)
    store/        # Zustand state (auth + game)
    pages/        # Route-level components
    components/   # Board, Checkers, Dice, UI
```

---

## License

MIT
