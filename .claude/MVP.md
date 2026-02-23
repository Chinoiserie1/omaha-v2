# MVP.md — Ship It, Don't Over-Engineer It

> "Do things that don't scale." — Paul Graham
> 
> 
> "Build something a small number of people love." — Paul Graham
> 
> "The goal of an MVP is to learn, not to impress." — Michael Seibel
> 

---

## What We're Building

A crypto KOL investment tracking app.

**Investor User Journey (that's it):**

1. Browse & discover KOL portfolios — no login required.
2. Log in with X — only when ready to invest.
3. Invest in a portfolio.
4. Share it.

**Three steps. That's the whole product right now.**

---

## MVP Rules

### 1. If it's not in the user journey, it doesn't ship.

No feature gets added unless it directly serves one of the 3 steps above. Edge cases, nice-to-haves, and "what if users do X" are not your problem yet.

### 2. The app is public before the login wall.

Anyone can browse KOL portfolios without an account. Login with X is only triggered when a user wants to invest. No forced auth on landing, no teaser walls, no "sign up to see more." Discovery is free.

### 3. Twitter/X only — no multi-platform handling.

The app is Twitter-first. No fallback for users without Twitter. No dual username logic. No "what if they don't have an account" flows. When the app works and users love it, *then* you expand.

### 3. Simple > clever.

If there are two ways to build something, pick the simpler one. Every time. Simple code ships faster, breaks less, and is easier to fix.

### 4. Don't build for scale you don't have.

No caching layers, no queue systems, no retry logic, no rate limit handlers — until you have users hitting those limits. Premature optimization is a product killer.

### 5. No edge case handling in v1.

Edge cases are for v2. Ship for the happy path. If 90% of users can complete the 3-step journey, the MVP works.

---

## Red Flags (Stop and Simplify)

If you catch yourself doing any of these, stop:

- "We should also handle the case where..."
- "Let me build a proper abstraction for..."
- "We'll need this later when we scale..."
- "What if the user doesn't have Twitter..."
- Adding a config file for something that only has one value
- Writing tests before the feature even works
- Designing a database schema for data you're not collecting yet

---

## The MVP Question

Before writing any code, ask:

> **"Does this directly help a user complete one of the 3 steps?"**
> 

If the answer is no or "kind of" — don't build it.

---

## Definition of Done for This MVP

- [ ]  Anyone can browse KOL portfolios without logging in
- [ ]  User can log in with X (Twitter OAuth) — only when investing
- [ ]  User can invest in a KOL portfolio
- [ ]  User can share their portfolio

When all 3 work end-to-end on a real device with a real account — **the MVP is done**. Everything else is a distraction until then.

add "keep in mind we are a lean startup, keep things simple" in all your prompts.

---

*This file exists to protect the MVP from scope creep. When in doubt, re-read it.*