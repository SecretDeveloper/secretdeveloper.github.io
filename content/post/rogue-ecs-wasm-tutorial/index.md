+++
date = "2026-02-06T12:00:00+00:00"
title = "Rogue in Rust with ECS + WebAssembly"
description = "Notes from following the Rust Roguelike Tutorial and wiring the build to run in the browser"
categories = ["software", "games", "roguelike", "rust", "wasm"]
tags = ["ecs", "bracket-lib", "specs", "webgl", "tutorial"]
+++

I have been following the Rust Roguelike Tutorial to build a little Rogue-like with an ECS core. I only got partway through, but it was a fun, focused project and I now have a playable build running in the browser.

Try it here: [Rogue](/games/rogue/).

#### What I built so far

It is a classic tile-based dungeon crawl with keyboard controls (arrow keys, vi keys, and numpad). The Rust core uses `specs` for ECS and `bracket-lib` for the terminal style rendering model. I bridged it to the browser with `wasm-bindgen`, so it runs as a WebGL canvas.

#### The tutorial I followed

The build tracks the [Rust Roguelike Tutorial](https://bfnightly.bracketproductions.com/), which walks through the ECS architecture and step-by-step game features. The core loop is clean and incremental: get a map, place a player, add movement, add monsters, then keep layering systems.

#### Why this was fun

ECS fits this style of game really well. It keeps the entities small and the systems honest. Rust makes you think about ownership and data layout early, which pairs nicely with ECS. Getting it into WebAssembly means I can share a build instantly without bundling a native binary.

#### What is missing (for now)

The tutorial is only partially complete, so there are plenty of features still to add. I want to keep following it to finish inventory, skills, and a deeper progression loop.

If you want to dig in, the files are in `static/games/rogue/` and the WebAssembly build is wired up in `static/games/rogue/index.html`.
