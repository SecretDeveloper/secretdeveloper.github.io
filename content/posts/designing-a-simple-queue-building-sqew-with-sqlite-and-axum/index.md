+++
date = "2025-09-09T13:30:00+01:00"
title = "Designing a simple Queue: Building sqew with SQLite and Axum"
description = "Sqew is a small experimental attempt to build a full queue service using Rust, SQLite, Axum, and core interfaces."
draft = true
categories = ["software", "tools", "rust"]
tags = ["sqlite", "axum", "queue", "backend", "systems", "ai-assisted-development"]
series = ["Working with AI"]
+++

The basic idea was simple enough. I wanted a small message queue service with HTTP and JSON, backed only by SQLite. One binary, one database file, no extra infrastructure, something that theoretically would be useful for small jobs and side projects without Redis, RabbitMQ, or a whole second system to babysit.

The repo is here if you want to look at it:

- [SecretDeveloper/sqew](https://github.com/SecretDeveloper/sqew)

## Technology

The implementation settled on a fairly tight stack:

- `axum` for the HTTP layer
- `sqlx` with SQLite underneath
- `tokio` for async runtime
- `clap` for the CLI
- a single `queue.rs` interface sitting in the middle of the app

That middle piece mattered. Once `queue.rs` became the main interface for queue operations, the project got easier to reason about. The server, CLI, and tests all had a more obvious place to meet.

## SQLite

If the target is a lightweight queue for small to medium workloads, a single SQLite database is appealing for reasons that are mostly operational:

- there is very little to deploy
- the state is easy to inspect
- transactions are built in
- WAL mode gets you decent concurrency

## Stress tests

The repo has stress tests for that now, plus a `scripts/flame-stress.sh` helper to profile the hot path when the numbers get worse than I expect.

## Where it ended up

By the time the early September work settled down, `sqew` had a shape I actually liked:

- a small Rust service
- SQLite as the only state store
- HTTP and CLI interfaces over the same core queue logic
- stress tests instead of hand-waving
- containers and multi-arch work added after the core flow was working

I still think there is room to add more to it later. But if I do, I would rather earn each feature from actual use than from imagination.
