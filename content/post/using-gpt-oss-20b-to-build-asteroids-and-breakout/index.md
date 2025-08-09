+++
date = "2025-08-09T12:00:00+00:00"
title = "Using gpt-oss-20b to Build Asteroids and Breakout"
description = "Leveraging the open source 20B GPT model to generate two classic browser games"
categories = ["software", "games", "gpt-oss-20b"]
+++

In this post I explore how to use **gpt-oss-20b**, an open source 20-billion parameter language model, to prototype two classic browser games: Asteroids and Breakout. By iterating on prompts and refining the output, I generated working HTML5 Canvas implementations in around an hour or so.

#### About gpt-oss-20b

gpt-oss-20b is an open-source 20-billion parameter transformer-based language model released by OpenAI under the Apache 2.0 license. It is based on the GPT-4 architecture scaled to 20B parameters, trained on a diverse mix of web text, code, and documents. 

#### Setup

To host **gpt-oss-20b** locally, I used **LM Studio**:

1. Open LM Studio and select “Add Model.” Search for `openai/gpt-oss-20b` and click “Download.”
2. Once the model is installed, you can switch to the developer tab and click “Serve” (or use the CLI):
   ```bash
   lms server start
   ```
3. LM Studio now exposes a REST API at `http://127.0.0.1:1234`.
4. I checked that the service was working by running 
    ```bash 
    curl http://127.0.0.1:1234/v1/models
    ```
5. Next, configure **opencode** to connect to the local LM Studio endpoint. Here is what I used in my `~/.opencode/config.jsonc`:
    ```jsonc
    {
      "$schema": "https://opencode.ai/config.json",
      "provider": {
        "lmstudio": {
          "npm": "@ai-sdk/openai-compatible",
          "name": "LM Studio",
          "options": {
            "baseURL": "http://127.0.0.1:1234/v1"
          },
          "models": {
            "gpt-oss:20b": {
              "name": "LOCAL gpt-oss 20b"
            }
          }
        }
      },
      "model": "lmstudio/gpt-oss:20b"
    }
    ```

With this in place when you run `opencode` it will allow you to select gpt-oss-20b as the model to connect to.

<img src="./gpt-oss-20b-nvim-opencode.jpg" alt="gpt-oss-20b with opencode and nvim">


#### Generating the Asteroids Game

I prompted the model:

```text
Write an HTML file with embedded JavaScript using the Canvas API to implement the classic Asteroids game. Include ship movement, firing bullets, asteroid spawning, wrap-around screen, and basic collision detection.
```

After a few iterations, the model produced a solid foundation. Key parts include:

```js
class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.velocity = { x: 0, y: 0 };
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 10);
    ctx.lineTo(-7, 10);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  update() {
    // apply thrust, handle wrap-around, etc.
  }
}
```

I fine-tuned the physics parameters and added a simple scoring HUD. The final files live under `static/games/asteroids/` and can be tried live at [Asteroids](/games/asteroids/).

#### Generating the Breakout Game

Next, I asked:

```text
Create a Breakout (Arkanoid) style game in HTML, CSS, and JavaScript using the Canvas API. Include a paddle, ball physics, bricks layout, score tracking, and game over conditions.
```

The model generated code snippets like:

```js
const bricks = [];
for (let row = 0; row < rowCount; row++) {
  bricks[row] = [];
  for (let col = 0; col < colCount; col++) {
    let brickX = col * (brickWidth + padding) + offsetX;
    let brickY = row * (brickHeight + padding) + offsetY;
    bricks[row][col] = { x: brickX, y: brickY, status: 1 };
  }
}
```

A quick polish pass added sound effects and level progression. The result is served from `static/games/breakout/` and is available at [Breakout / Arkanoid](/games/breakout/).

#### Lessons Learned

Local LLMs enable offline experimentation and greater control over data privacy. However, they still require significant compute resources (e.g., GPUs with tens of GBs of VRAM) and substantial startup time. In many cases, local models are not as accurate or powerful as the largest state-of-the-art models offered by cloud providers, especially on complex reasoning tasks. Even with local hosting, prompt engineering and manual adjustments remain critical for high-quality 
output.

