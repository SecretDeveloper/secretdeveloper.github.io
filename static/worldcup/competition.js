(function () {
  const DATA_BASE = "/worldcup/data";
  const DATA_FILES = {
    players: `${DATA_BASE}/players.csv`,
    teams: `${DATA_BASE}/teams.csv`,
    assignments: `${DATA_BASE}/assignments.csv`,
    matches: `${DATA_BASE}/matches.csv`,
    scoring: `${DATA_BASE}/scoring.csv`,
  };

  const app = document.querySelector("[data-worldcup-app]");
  if (!app) return;

  const state = {
    players: [],
    teams: [],
    assignments: [],
    matches: [],
    scoring: [],
  };

  const byId = (items) => new Map(items.map((item) => [item.id, item]));
  const status = app.querySelector("[data-worldcup-status]");

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        quoted = !quoted;
        continue;
      }

      if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);

    const headers = rows.shift() || [];
    return rows.map((values) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), (values[index] || "").trim()])),
    );
  }

  async function loadCsv(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Could not load ${url}: ${response.status}`);
    }
    return parseCsv(await response.text());
  }

  function scoringMap() {
    return Object.fromEntries(state.scoring.map((rule) => [rule.event, Number(rule.points) || 0]));
  }

  function matchIsPlayed(match) {
    return match.score_a !== "" && match.score_b !== "";
  }

  function resultFor(match, teamId) {
    if (!matchIsPlayed(match)) return null;
    const isA = match.team_a === teamId;
    const goalsFor = Number(isA ? match.score_a : match.score_b);
    const goalsAgainst = Number(isA ? match.score_b : match.score_a);
    if (Number.isNaN(goalsFor) || Number.isNaN(goalsAgainst)) return null;

    return {
      played: 1,
      wins: goalsFor > goalsAgainst ? 1 : 0,
      draws: goalsFor === goalsAgainst ? 1 : 0,
      losses: goalsFor < goalsAgainst ? 1 : 0,
      goalsFor,
      goalsAgainst,
      cleanSheets: goalsAgainst === 0 ? 1 : 0,
    };
  }

  function emptyStats(player) {
    return {
      player,
      teams: [],
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      cleanSheets: 0,
      points: 0,
    };
  }

  function emptyTeamStats(team) {
    return {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      cleanSheets: 0,
      points: 0,
    };
  }

  function scoreTeam(team) {
    const rules = scoringMap();
    const stats = emptyTeamStats(team);
    const teamMatches = state.matches.filter((match) => match.team_a === team.id || match.team_b === team.id);

    for (const match of teamMatches) {
      const result = resultFor(match, team.id);
      if (!result) continue;

      stats.played += result.played;
      stats.wins += result.wins;
      stats.draws += result.draws;
      stats.losses += result.losses;
      stats.goalsFor += result.goalsFor;
      stats.goalsAgainst += result.goalsAgainst;
      stats.cleanSheets += result.cleanSheets;
      stats.points += result.wins * rules.win;
      stats.points += result.draws * rules.draw;
      stats.points += result.goalsFor * rules.goal_for;
      stats.points += result.cleanSheets * rules.clean_sheet;
    }

    return stats;
  }

  function calculateStandings() {
    const rules = scoringMap();
    const teams = byId(state.teams);
    const players = byId(state.players);
    const standings = new Map(state.players.map((player) => [player.id, emptyStats(player)]));

    for (const assignment of state.assignments) {
      const player = players.get(assignment.player_id);
      const team = teams.get(assignment.team_id);
      if (player && team) {
        standings.get(player.id).teams.push(team);
      }
    }

    for (const standing of standings.values()) {
      for (const team of standing.teams) {
        const teamMatches = state.matches.filter((match) => match.team_a === team.id || match.team_b === team.id);
        for (const match of teamMatches) {
          const result = resultFor(match, team.id);
          if (!result) continue;

          standing.played += result.played;
          standing.wins += result.wins;
          standing.draws += result.draws;
          standing.losses += result.losses;
          standing.goalsFor += result.goalsFor;
          standing.goalsAgainst += result.goalsAgainst;
          standing.cleanSheets += result.cleanSheets;
          standing.points += result.wins * rules.win;
          standing.points += result.draws * rules.draw;
          standing.points += result.goalsFor * rules.goal_for;
          standing.points += result.cleanSheets * rules.clean_sheet;
        }
      }
    }

    return [...standings.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalsFor - b.goalsAgainst !== a.goalsFor - a.goalsAgainst) {
        return b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
      }
      return a.player.name.localeCompare(b.player.name);
    });
  }

  function calculatePlayerScores() {
    const teams = byId(state.teams);
    const playerScores = state.players.map((player) => {
      const assignedTeams = state.assignments
        .filter((assignment) => assignment.player_id === player.id)
        .map((assignment) => teams.get(assignment.team_id))
        .filter(Boolean)
        .map(scoreTeam);
      const total = assignedTeams.reduce((sum, teamStats) => sum + teamStats.points, 0);
      return { player, teams: assignedTeams, total };
    });

    return playerScores.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.player.name.localeCompare(b.player.name);
    });
  }

  function teamOwnerMap() {
    const players = byId(state.players);
    return new Map(
      state.assignments
        .map((assignment) => [assignment.team_id, players.get(assignment.player_id)])
        .filter(([, player]) => Boolean(player)),
    );
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPills(container, teams) {
    container.innerHTML = "";
    for (const team of teams) {
      const pill = teamPill(team);
      container.appendChild(pill);
    }
  }

  function teamPill(team) {
    const pill = el("span", "worldcup-pill");
    pill.dataset.teamId = team.id;
    pill.classList.add(`worldcup-pill-${team.tier}`);
    pill.appendChild(el("span", "worldcup-flag", team.flag || "⚽"));
    pill.appendChild(el("span", "", `${team.name} (${team.tier})`));
    return pill;
  }

  function teamName(team, fallback) {
    if (!team) return fallback;
    return `${team.flag || "⚽"} ${team.name}`;
  }

  function tierLabel(tier) {
    if (tier === "longshot") return "Long shots";
    return `${tier[0].toUpperCase()}${tier.slice(1)} tier`;
  }

  function renderStandings() {
    const tbody = app.querySelector("[data-standings-body]");
    tbody.innerHTML = "";

    calculateStandings().forEach((standing, index) => {
      const row = document.createElement("tr");
      const teamCell = document.createElement("td");
      const teamStack = el("div", "worldcup-team-stack");
      renderPills(teamStack, standing.teams);
      teamCell.appendChild(teamStack);

      const values = [
        index + 1,
        standing.player.name,
        teamCell,
        standing.wins,
        standing.draws,
        standing.losses,
        standing.goalsFor,
        standing.goalsAgainst,
        standing.points,
      ];

      for (const value of values) {
        const cell = document.createElement("td");
        if (value instanceof HTMLElement) cell.appendChild(value);
        else cell.textContent = value;
        row.appendChild(cell);
      }

      tbody.appendChild(row);
    });
  }

  function renderAssignments() {
    const list = app.querySelector("[data-assignments-list]");
    const teams = byId(state.teams);
    list.innerHTML = "";

    for (const player of state.players) {
      const card = el("article", "worldcup-card");
      card.appendChild(el("h3", "", player.name));
      const stack = el("div", "worldcup-team-stack");
      const assignedTeams = state.assignments
        .filter((assignment) => assignment.player_id === player.id)
        .map((assignment) => teams.get(assignment.team_id))
        .filter(Boolean);
      renderPills(stack, assignedTeams);
      card.appendChild(stack);
      list.appendChild(card);
    }
  }

  function renderTiers() {
    const list = app.querySelector("[data-tier-list]");
    list.innerHTML = "";
    for (const tier of ["top", "middle", "longshot"]) {
      const teams = state.teams.filter((team) => team.tier === tier);
      const section = el("section", "worldcup-tier");
      section.appendChild(el("h3", "", tierLabel(tier)));
      const stack = el("div", "worldcup-team-stack");
      renderPills(stack, teams);
      section.appendChild(stack);
      list.appendChild(section);
    }
  }

  function renderPlayerScores() {
    const list = app.querySelector("[data-player-scores-list]");
    list.innerHTML = "";

    calculatePlayerScores().forEach((score, index) => {
      const card = el("article", "worldcup-player-score-card");
      const header = el("div", "worldcup-player-score-header");
      const title = document.createElement("h3");
      title.textContent = `${index + 1}. ${score.player.name}`;
      header.appendChild(title);
      header.appendChild(el("strong", "", `${score.total} pts`));
      card.appendChild(header);

      const teamList = el("div", "worldcup-team-score-list");
      for (const teamStats of score.teams) {
        const row = el("div", "worldcup-team-score-row");
        const teamName = el("span", "", teamNameWithTier(teamStats.team));
        const record = el(
          "small",
          "",
          `${teamStats.points} pts - ${teamStats.wins}W ${teamStats.draws}D ${teamStats.losses}L, ${teamStats.goalsFor} GF, ${teamStats.cleanSheets} CS`,
        );
        row.appendChild(teamName);
        row.appendChild(record);
        teamList.appendChild(row);
      }
      card.appendChild(teamList);
      list.appendChild(card);
    });
  }

  function renderDrawBoard() {
    renderDrawTiers();
    renderDrawPlayerSlots([]);
  }

  function renderDrawTiers(drawnTeamIds = new Set()) {
    const list = app.querySelector("[data-draw-tier-list]");
    list.innerHTML = "";
    for (const tier of ["top", "middle", "longshot"]) {
      const teams = state.teams.filter((team) => team.tier === tier);
      const section = el("section", "worldcup-tier");
      section.appendChild(el("h3", "", tierLabel(tier)));
      const stack = el("div", "worldcup-team-stack");
      for (const team of teams) {
        const pill = teamPill(team);
        if (drawnTeamIds.has(team.id)) {
          pill.classList.add("worldcup-pill-drawn");
          pill.appendChild(el("span", "worldcup-pill-state", "assigned"));
          pill.setAttribute("aria-label", `${team.name} assigned`);
        } else if (drawnTeamIds.size > 0) {
          pill.classList.add("worldcup-pill-undrawn");
          pill.appendChild(el("span", "worldcup-pill-state", "not assigned"));
        }
        stack.appendChild(pill);
      }
      section.appendChild(stack);
      list.appendChild(section);
    }
  }

  function renderDrawPlayerSlots(generatedAssignments) {
    const slots = app.querySelector("[data-draw-player-slots]");
    const assignedByPlayer = new Map(state.players.map((player) => [player.id, []]));

    for (const assignment of generatedAssignments) {
      assignedByPlayer.get(assignment.player.id)?.push(assignment.team);
    }

    slots.innerHTML = "";
    for (const player of state.players) {
      const slot = el("article", "worldcup-draw-player-slot");
      slot.dataset.playerId = player.id;
      slot.appendChild(el("h3", "", player.name));
      const teams = assignedByPlayer.get(player.id) || [];
      const stack = el("div", "worldcup-draw-slot-teams");
      stack.dataset.drawSlotTeams = "";

      if (teams.length === 0) {
        stack.appendChild(el("span", "worldcup-empty-slot", "Waiting for draw"));
      } else {
        for (const team of teams) {
          const pill = teamPill(team);
          pill.classList.add("worldcup-pill-assigned");
          stack.appendChild(pill);
        }
      }

      slot.appendChild(stack);
      slots.appendChild(slot);
    }
  }

  function renderMatchBoard() {
    const list = app.querySelector("[data-match-board]");
    const teams = byId(state.teams);
    const owners = teamOwnerMap();
    list.innerHTML = "";

    const groups = [
      { title: "Played", matches: state.matches.filter(matchIsPlayed) },
      { title: "To Be Played", matches: state.matches.filter((match) => !matchIsPlayed(match)) },
    ];

    for (const group of groups) {
      const section = el("section", "worldcup-match-board-section");
      section.appendChild(el("h3", "", group.title));
      const matches = el("div", "worldcup-match-list");

      for (const match of group.matches) {
        const teamA = teams.get(match.team_a);
        const teamB = teams.get(match.team_b);
        const item = el("article", `worldcup-match ${matchIsPlayed(match) ? "worldcup-match-played" : "worldcup-match-upcoming"}`);
        const details = document.createElement("div");
        details.appendChild(el("h3", "", `${teamName(teamA, match.team_a)} vs ${teamName(teamB, match.team_b)}`));
        details.appendChild(renderMatchOwners(match, teamA, teamB, owners));
        details.appendChild(el("div", "worldcup-match-meta", `${match.stage} - ${match.date}`));
        item.appendChild(details);
        item.appendChild(el("div", "worldcup-score", matchIsPlayed(match) ? `${match.score_a}-${match.score_b}` : "TBD"));
        matches.appendChild(item);
      }

      section.appendChild(matches);
      list.appendChild(section);
    }
  }

  function renderMatchOwners(match, teamA, teamB, owners) {
    const row = el("div", "worldcup-match-owners");
    row.appendChild(renderMatchOwner(match, teamA, owners.get(teamA?.id)));
    row.appendChild(renderMatchOwner(match, teamB, owners.get(teamB?.id)));
    return row;
  }

  function renderMatchOwner(match, team, owner) {
    const ownerName = owner?.name || "Unassigned";
    const points = team ? pointsForMatch(match, team.id) : null;
    const pointsText = points === null ? "pending" : `+${points} pts`;
    const item = el("span", "", `${teamName(team, "Team")}: ${ownerName} (${pointsText})`);
    return item;
  }

  function teamNameWithTier(team) {
    return `${teamName(team, "Team")} (${team.tier})`;
  }

  function pointsForMatch(match, teamId) {
    const rules = scoringMap();
    const result = resultFor(match, teamId);
    if (!result) return null;

    return (
      result.wins * rules.win +
      result.draws * rules.draw +
      result.goalsFor * rules.goal_for +
      result.cleanSheets * rules.clean_sheet
    );
  }

  function renderRules() {
    const list = app.querySelector("[data-rules-list]");
    list.innerHTML = "";
    for (const rule of state.scoring) {
      const row = document.createElement("div");
      row.appendChild(el("dt", "", rule.label));
      row.appendChild(el("dd", "", rule.points));
      list.appendChild(row);
    }
  }

  function renderSummary() {
    app.querySelector("[data-summary-players]").textContent = state.players.length;
    app.querySelector("[data-summary-teams]").textContent = state.assignments.length;
    app.querySelector("[data-summary-matches]").textContent = state.matches.filter(matchIsPlayed).length;
  }

  function hashSeed(seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = hashSeed(seed) || 1;
    return function next() {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return ((value >>> 0) % 1000000) / 1000000;
    };
  }

  function shuffle(items, random) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  async function runDraw() {
    const seed = app.querySelector("#worldcup-seed").value.trim() || "worldcup";
    const drawButton = app.querySelector("[data-run-draw]");
    drawButton.disabled = true;
    drawButton.textContent = "Drawing...";

    const random = seededRandom(seed);
    const tiers = {
      top: shuffle(state.teams.filter((team) => team.tier === "top"), random),
      middle: shuffle(state.teams.filter((team) => team.tier === "middle"), random),
      longshot: shuffle(state.teams.filter((team) => team.tier === "longshot"), random),
    };

    const rows = ["player_id,team_id"];
    const generatedAssignments = [];
    state.players.forEach((player, index) => {
      for (const tier of Object.keys(tiers)) {
        const team = tiers[tier][index];
        if (team) {
          rows.push(`${player.id},${team.id}`);
          generatedAssignments.push({ player, team });
        }
      }
    });

    const outputPanel = app.querySelector("[data-draw-output-panel]");
    const output = app.querySelector("[data-draw-output]");
    outputPanel.hidden = true;
    output.value = "";
    renderDrawTiers();
    renderDrawPlayerSlots([]);
    setStatus(`Drawing teams from seed "${seed}"...`);

    try {
      for (const assignment of generatedAssignments) {
        await dealTeamToPlayer(assignment);
      }

      renderDrawTiers(new Set(generatedAssignments.map((assignment) => assignment.team.id)));
      output.value = rows.join("\n");
      outputPanel.hidden = false;
      setStatus(`Generated draw from seed "${seed}".`);
    } finally {
      drawButton.disabled = false;
      drawButton.textContent = "Run draw";
    }
  }

  function teamSelector(teamId) {
    if (globalThis.CSS?.escape) return `[data-team-id="${CSS.escape(teamId)}"]`;
    return `[data-team-id="${teamId.replace(/"/g, '\\"')}"]`;
  }

  async function dealTeamToPlayer({ player, team }) {
    const source = app.querySelector(`[data-draw-tier-list] ${teamSelector(team.id)}`);
    const targetStack = app.querySelector(`[data-player-id="${player.id}"] [data-draw-slot-teams]`);
    if (!source || !targetStack) return;

    const emptySlot = targetStack.querySelector(".worldcup-empty-slot");
    if (emptySlot) emptySlot.remove();

    const target = teamPill(team);
    target.classList.add("worldcup-pill-assigned");
    target.classList.add("worldcup-pill-pending");
    targetStack.appendChild(target);

    await animateDeal(source, target);

    source.classList.add("worldcup-pill-drawn");
    source.setAttribute("aria-label", `${team.name} drawn`);
    target.classList.remove("worldcup-pill-pending");
  }

  function animateDeal(source, target) {
    if (!source.getBoundingClientRect || !target.getBoundingClientRect) {
      return delay(50);
    }

    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const clone = source.cloneNode(true);

    clone.classList.add("worldcup-flying-pill");
    clone.style.left = `${sourceRect.left}px`;
    clone.style.top = `${sourceRect.top}px`;
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    document.body.appendChild(clone);

    const deltaX = targetRect.left - sourceRect.left;
    const deltaY = targetRect.top - sourceRect.top;

    if (clone.animate) {
      clone.animate(
        [
          { transform: "translate(0, 0)", opacity: 1 },
          { transform: `translate(${deltaX}px, ${deltaY}px)`, opacity: 1 },
        ],
        { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      return delay(230).finally(() => {
        clone.remove();
      });
    }

    clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    return delay(220).finally(() => {
      clone.remove();
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function render() {
    renderSummary();
    renderDrawBoard();
    renderRules();
    renderPlayerScores();
    renderMatchBoard();
  }

  async function init() {
    try {
      const [players, teams, assignments, matches, scoring] = await Promise.all([
        loadCsv(DATA_FILES.players),
        loadCsv(DATA_FILES.teams),
        loadCsv(DATA_FILES.assignments),
        loadCsv(DATA_FILES.matches),
        loadCsv(DATA_FILES.scoring),
      ]);
      Object.assign(state, { players, teams, assignments, matches, scoring });
      render();
      app.querySelector("[data-run-draw]").addEventListener("click", runDraw);
      setStatus("Competition data loaded from local CSV files.");
    } catch (error) {
      console.error(error);
      setStatus("Could not load competition data. Check the CSV files and browser console.");
    }
  }

  init();
})();
