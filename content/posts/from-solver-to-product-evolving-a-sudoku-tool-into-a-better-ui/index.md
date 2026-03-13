+++
date = "2026-02-24T11:00:00+00:00"
title = "From Solver to Product: Evolving a Sudoku Tool into a Better UI"
description = "The Sudoku project started as a solver that worked. The more interesting work was turning it into something clearer, faster to use, and less annoying to live with."
draft = true
categories = ["software", "games", "sudoku"]
tags = ["javascript", "ui", "product", "puzzle", "ai-assisted-development"]
series = ["Working with AI"]
+++

The first version of the Sudoku project solved puzzles. That was the easy part.

The harder part was making it pleasant to use.

The repo history for this one is fairly honest. On January 30th I had:

`working version in 1 prompt, pretty version in 2 more prompts`

That got me over the line into “there is a thing on the screen and it sort of works”. It did not get me to a tool I would keep open and use.

The rest of the work was mostly product work disguised as bug fixing and polish.

## The solver was only half the job

By the end of that first day the app could step through a solve and it could handle puzzles up to New York Times hard. The commits around that are straightforward:

`working solver stepper`

`layout and stepper improvements`

`solves nyt hard`

That sounds like a finished feature set. In practice it was just the point where the real trade-offs became visible.

Once the solver existed, the question changed from “can this solve a puzzle?” to “can someone understand what it is doing, recover from a mistake, and move around the board without friction?”

That second question mattered more.

## I wanted the board to be efficient and fun to use

The current UI is built around that idea.

That shape did not appear all at once. It came from noticing where the earlier versions felt clumsy.

If I had to summarize the UI work, it was mostly this:

- reduce context switching
- make the next useful action obvious
- keep the board state readable
- do not make the solver feel magical

That is a more practical design brief than “make it look nice”, even though a fair amount of the visible work was styling.

## The solver needed to explain itself

I wanted to provide hints to the user on where the next change could be made.

So the solver code ended up returning not only actions, but evidence. Each tactic produces a label and a sentence about why the move is valid. That feeds the hint panel and the step log. The UI then highlights the affected cells and links the recorded step back to the tactic explanation section.

The current script covers a decent range of tactics now:

- naked and hidden singles
- naked and hidden sets
- pointing and claiming
- X-Wing, Swordfish, Jellyfish
- XY-Wing, XYZ-Wing, W-Wing
- Skyscraper

## AI helped most when the direction was already clear

This project is a good example of the sort of help I find useful from AI.

It was fast at getting me through iterations once I knew what I wanted:

- reshaping parts of the UI
- wiring controls to state
- helping push more tactics into code
- tightening some of the repetitive logic around candidates and step history

That is still the useful dividing line for me. AI is good once the goal is concrete. The product judgment still sits elsewhere.
