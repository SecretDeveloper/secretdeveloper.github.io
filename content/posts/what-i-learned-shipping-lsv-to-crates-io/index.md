+++
date = "2026-03-07T14:00:00+00:00"
title = "What I Learned Shipping lsv to Crates.io"
description = "Shipping a small Rust tool turned out to be less about pressing publish and more about naming, packaging, docs, CI, platform quirks, and the messier reality after 0.1.0."
draft = false
categories = ["software", "tools", "rust"]
tags = ["terminal", "cli", "developer-tools", "crates-io", "release-engineering", "ai-assisted-development"]
series = ["Working with AI"]
+++

I have shipped plenty of software inside teams and companies, but publishing a small tool to crates.io has a different feel to it.

`lsv` is a three-pane terminal file browser I built in Rust with Lua configuration. By the time I started thinking seriously about crates.io, the core idea already worked. I could move around, preview files, run commands, wire up custom actions, and generally use it for real. I had convinced myself the software existed.

If you want to look at the actual project, it is here:

- GitHub: [SecretDeveloper/lsv](https://github.com/SecretDeveloper/lsv)
- Crates.io: [lsv](https://crates.io/crates/lsv)
- Docs: [docs.rs/lsv](https://docs.rs/lsv)

## Names matter

The tool originally started life as `lv`, which felt fine for about five minutes and then promptly ran into reality. One of the September commits is literally `renamed lv to lsv due to conflict with existing tools`, which is not a glamorous milestone but probably one of the most important ones in the whole repo.

## Think about shipping early

Looking back over the repo, there is a very clear shift in tone once I started preparing the tool for the outside world.

Early commits are what you would expect:

`initial working version, buggy`

`less buggy, more configy`

`external commands`

`previews working`

That is the phase where the software is still negotiating with itself.

Then the vocabulary changes:

`prep for publish`

`package changes`

`CI and Readme updates`

`switching to nightly for ci build`

I think this is where a lot of side projects quietly die. Building the interesting thing is fun. Turning it into something that installs cleanly, documents itself, survives CI, and behaves on more than one machine is much less romantic.

## The README is part of the product

I rewrote the README multiple times while building `lsv`, and I do not think that was wasted motion.

By the time the tool had previews, Lua actions, themes, external commands, command palette support, and file operations, it was no longer obvious how someone should approach it. The software was getting better, but the entry point was getting worse.

That is a pattern I seem to repeat a lot. A project grows in capability and, without noticing, I raise the cognitive cost of touching it for the first time.

The README rewrites had to answer basic questions I had been postponing:

- What is the tool, in one sentence?
- What does it actually do?
- Why is Lua here?
- How does someone get from `cargo install lsv` to a working setup?
- What breaks on Windows? Everything it turns out.

## First-run experience matters more than I wanted it to

Adding `--init-config` made the tool feel more like a thing you can actually adopt. It can drop a ready-to-edit config into the right place, along with themes and example settings, and the user can then start making it theirs.

## CI is really useful

I switched the repo to a nightly toolchain and wired CI across `ubuntu`, `macos`, and `windows`. At the time it felt like overhead. In practice it became a way to preserve expectations.

I also added format and lint checks, stricter clippy settings, and later fixed a test race condition before releasing `0.1.12`. Again, not glamorous. Very useful.

## What I took from it

I like building the feature-heavy part more. But shipping `lsv` was a useful reminder that finishing a tool means thinking about the bits that are easiest to postpone.
