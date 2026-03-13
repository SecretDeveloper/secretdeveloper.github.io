+++
date = "2026-02-03T15:00:00+00:00"
title = "Adding Tactics to a Sudoku Solver Without Turning It Into a Mess"
description = "The Sudoku solver got more useful once it moved past singles, but the hard part was adding tactics in a way that still produced understandable steps and evidence."
draft = false
categories = ["software", "games", "sudoku"]
tags = ["javascript", "solver", "algorithms", "puzzle", "ai-assisted-development"]
series = ["Working with AI"]
+++

One of the nice things about Sudoku solvers is that they scale badly in an interesting way.

The first steps are easy. Naked singles and hidden singles are not much trouble. You can get a working stepper quite quickly and it feels good because the board starts moving.

But then you need to add the trickier tactics.

The code and the playable version are here:

- Repo: [SecretDeveloper/sudoku](https://github.com/SecretDeveloper/sudoku)
- Live version on this site: [Sudoku Editor](/games/sudoku/)
- Related post: [Building a Sudoku Editor with GPT-5.2](/posts/sudoku-editor-with-gpt-5-2/)

## I wanted one shape for a solving step

The main thing that kept this manageable was forcing every tactic through the same output shape.

In the script there is a `findStep(board, autoElims)` function. It builds the current candidate map once, then tries tactics in order:

- naked single
- hidden single
- naked set
- hidden set
- pointing pair / claiming pair
- fish patterns
- wing patterns
- skyscraper

The important part is not the order. The important part is that every successful tactic returns the same kind of object:

- either a value to place in a cell
- or a set of candidate eliminations
- plus a tactic name
- plus an evidence string

That evidence string ended up mattering a lot. Without it, the solver would still work, but the stepper and hint system would not.

## Eliminations are where things get messy

Singles are easy because they end with a number in a square.

Most of the interesting tactics do not. They end with “these candidates can be removed from these cells because of this pattern”. That is a much more awkward thing to represent cleanly.

The code reflects that shift pretty directly. Tactics like `findNakedSet`, `findHiddenSet`, `findPointingPair`, `findClaimingPair`, `findFish`, `findXYWing`, `findXYZWing`, `findWWing`, and `findSkyscraper` all return `eliminations` rather than a placed digit.

That let me keep the stepper simple. A step either places a value immediately, or it changes the candidate state and leaves the board ready for the next move. The UI does not need a completely different model for each tactic.

That was probably the most useful structural decision in the solver.

## The fish and wing tactics were the point where this stopped being casual

Patterns like fish are a good example. In code they are mostly about candidate positions lining up across rows or columns. That is not too bad once you reduce it to combinations and set comparisons. The ugly part is making sure the eliminations are correct and describing them in a way the step log can show without sounding like nonsense.

The evidence text ended up doing a lot of work there. For example, fish-based steps describe which rows align on which columns, or the other way around, and then state what was removed.

## The order of tactics matters

The solver does not search for the fanciest possible move. It searches in a fixed order and takes the first usable step.

I did not want a solver that jumped to something exotic while simpler moves were still available. The point of the project was not to show off hard tactics. The point was to make the next step understandable.

So the current order starts with singles, moves through sets and line-box interactions, then gets into fish and wing patterns. That makes the output feel more human and it also made the code easier to debug, because I had a clearer sense of which layer was supposed to fire first.
