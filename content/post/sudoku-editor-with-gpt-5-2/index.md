+++
date = "2026-02-06T12:00:00+00:00"
title = "Building a Sudoku Editor with GPT-5.2"
description = "A Sudoku editor, generator, and step solver built with GPT-5.2 in the loop"
categories = ["software", "games", "sudoku", "gpt-5.2"]
tags = ["javascript", "puzzle", "ui", "tooling"]
+++

I wanted a Sudoku editor that feels like a quiet desk: place numbers, track candidates, get nudges, and keep the board readable. So I built one with GPT-5.2 helping me iterate the UI and logic.

You can try it here: [Sudoku Editor](/games/sudoku/).

#### What it does

- 9x9 editor with keyboard navigation, input validation, and clear visual feedback.
- Candidate mode with a manual pencil-mark layer, plus optional auto-candidates.
- Generator with difficulty targets (easy/medium/hard) and uniqueness checks.
- Step solver with hints and a log that explains the tactic used.
- Quality-of-life actions: New, Reset, Undo, Copy, Load.

#### The bits I like

- The board reacts quickly. It highlights row/column/box, matches values, and invalid cells without feeling noisy.
- The candidate system has two layers: manual marks you place and auto-candidates the solver derives. You can flip between them without losing your notes.
- The step solver does not just fill cells; it shows the reasoning and keeps a trail so you can walk back through the tactics.

#### How the solver thinks

The solver starts with the basics (naked and hidden singles), then escalates through sets, pointing/claiming, fish, and wing tactics. I wanted the hints to be helpful rather than magical, so each step reports the evidence in plain language.

#### GPT-5.2 in the loop

I used GPT-5.2 to help shape the workflow and edge cases: syncing UI state, tracking undo history, and keeping the candidate display honest. It was especially useful for turning Sudoku tactics into deterministic code paths, then tightening the wording so hints stayed readable.

#### What I would still like to add

- A few curated puzzles that demonstrate specific tactics.
- A way to export/share a puzzle without copy-pasting a long string.
- A stronger "play this line next" so the step log picks the most useful next move.

If you want to dig into the implementation, the files live in `static/games/sudoku/`.
