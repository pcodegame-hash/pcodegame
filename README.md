# Project CodeGame — Backend (Progress + Skill Confidence)

Minimal Node/Express + MongoDB Atlas backend implementing the two systems currently
wired up on the Unity side: player progress and skill-confidence/tier tracking.
Judge0 (code execution) and auth are intentionally **not** included yet — see the
roadmap's Phase 2/3 for those.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your real MongoDB Atlas connection string
npm run dev      # nodemon, auto-restarts on file changes
# or: npm start
```

Server starts on `http://localhost:3000` by default. Check it's alive:

```bash
curl http://localhost:3000/health
```

## Wiring it into Unity

1. Create an `ApiConfig` asset: `Assets > Create > CodeGame > Api Config`.
2. Set `baseUrl` to `http://localhost:3000/api` (or your deployed server's address).
3. Leave `offlineMode` unchecked.
4. Assign the asset to `BackendServicesBootstrap` on your persistent Bootstrap
   GameObject (same object as `GameManager`).

If the server is unreachable, `HttpProgressService`/`HttpSkillConfidenceService`
log a warning and fall back to hardcoded safe defaults (empty progress, NEWB tier) —
gameplay never hard-blocks on the backend being up.

## Endpoints

| Method | Path | Body / Params | Response |
|---|---|---|---|
| GET | `/api/progress/:userId` | — | `{ completedLevelIds: string[] }` |
| POST | `/api/progress/level-complete` | `{ userId, levelId, xpAwarded }` | `{ completedLevelIds, xpTotal }` |
| POST | `/api/progress/puzzle-solved` | `{ userId, levelId, puzzleId, attemptCount }` | `{ ok: true }` |
| POST | `/api/skill-confidence/report` | `{ userId, chapterId, timeToSolveSeconds, expectedTimeSeconds, hintsUsed, maxHints, errorScore, firstAttemptSuccess }` | `{ confidence, tier }` |
| GET | `/api/skill-confidence/:userId/:chapterId` | — | `{ confidence, tier }` |

These field names are exact — `JsonUtility` on the Unity side is strict about
matching them, so don't rename anything here without updating the C# DTOs in
`HttpProgressService.cs` / `HttpSkillConfidenceService.cs` to match.

## Notes

- `src/skillConfidence.js` is a deliberate line-for-line JS port of Unity's
  `SkillConfidenceCalculator` (weights, time-decay curve, tier thresholds, 5-entry
  rolling window). If you tune the formula, change both files together — otherwise
  the offline local-session fallback in `HttpSkillConfidenceService.cs` will disagree
  with the server once connectivity returns.
- `Progress` is one document per `userId`; `completedLevelIds` uses `$addToSet` so
  replaying a level-complete call (e.g. after a flaky connection) doesn't duplicate.
- `SkillConfidence` is one document per `(userId, chapterId)` pair.
- No auth yet — every request trusts the `userId` it's given. Fine for local/beta
  testing with `"local-player"`, not for a real multi-user deployment (see roadmap
  Phase 3 for JWT auth).
