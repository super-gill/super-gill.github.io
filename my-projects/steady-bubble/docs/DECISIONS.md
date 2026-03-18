# Steady Bubble — Decisions Log

Architectural and process decisions made during the project. Recorded so they are not re-argued in future sessions.

---

## D001 — Bugs are ported, not fixed during migration

**Decision:** If a bug is discovered in V1 code during migration, it is ported into V2 as-is. It is not fixed.

**Why:** The migration has one job — reproduce V1 behavior faithfully. Fixing bugs during migration introduces a second variable: it becomes impossible to tell whether a regression is caused by the restructure or by the fix. This keeps the sign-off criteria clean: V2 passes when it behaves like V1, bugs included.

**How to apply:** When a bug is identified during migration, log it below in the Known Bugs section and continue. Bug fixes are post-migration work, out of scope for V2.

---

## Known Bugs (ported knowingly)

| ID | Description | V1 Location | Logged |
|---|---|---|---|
| — | None logged yet | — | — |
