(function () {
  const app = document.querySelector("[data-worldcup-app]");
  if (!app) return;

  const DATA_BASE = app.dataset.dataBase || "/worldcup/data";
  const WORLD_CUP_SOURCE_URL =
    app.dataset.worldCupSourceUrl || "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
  const DATA_FILES = {
    players: `${DATA_BASE}/players.csv`,
    tiers: `${DATA_BASE}/tiers.csv`,
    assignments: `${DATA_BASE}/assignments.csv`,
    scoring: `${DATA_BASE}/scoring.csv`,
  };

  const state = {
    players: [],
    teams: [],
    tiers: [],
    assignments: [],
    matches: [],
    scoring: [],
    sourceName: "World Cup 2026",
  };

  const PLAYER_COLORS = [
    "#e95d3c",
    "#087248",
    "#145da0",
    "#c99320",
    "#7b61ff",
    "#d9488f",
    "#008f8c",
    "#8a5a2b",
    "#5f6f1f",
  ];

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

  async function loadWorldCupJson() {
    const response = await fetch(WORLD_CUP_SOURCE_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Could not load ${WORLD_CUP_SOURCE_URL}: ${response.status}`);
    }
    return response.json();
  }

  function sourceTeamId(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function isPlaceholderTeamName(name) {
    return (
      !name ||
      /^[WL]\d+$/i.test(name) ||
      /^\d[A-L]$/i.test(name) ||
      /^\d[A-L](?:\/[A-L])+$/.test(name)
    );
  }

  function normalizeWorldCupData(source, tiers) {
    const tierMap = new Map(tiers.map((tier) => [tier.team_id, tier]));
    const sourceTeams = new Map();

    for (const match of source.matches || []) {
      for (const name of [match.team1, match.team2]) {
        if (isPlaceholderTeamName(name)) continue;
        const id = sourceTeamId(name);
        const tier = tierMap.get(id);
        sourceTeams.set(id, {
          id,
          name,
          tier: tier?.tier || "unseeded",
          flag: tier?.flag || "⚽",
          fifaRank: tier?.fifa_rank || "",
          fifaPoints: tier?.fifa_points || "",
        });
      }
    }

    return {
      sourceName: source.name || "World Cup 2026",
      teams: [...sourceTeams.values()].sort((a, b) => a.name.localeCompare(b.name)),
      matches: (source.matches || []).map((match, index) => {
        const goalScore = match.score?.et || match.score?.ft || [];
        const penaltyScore = match.score?.p || [];
        return {
          id: `match_${index + 1}`,
          date: match.date || "",
          time: match.time || "",
          sort_time: matchSortTime(match),
          group: match.group || "",
          round: match.round || "",
          stage: [match.group, match.round].filter(Boolean).join(" - ") || match.round || "",
          ground: match.ground || "",
          team_a: isPlaceholderTeamName(match.team1) ? "" : sourceTeamId(match.team1),
          team_b: isPlaceholderTeamName(match.team2) ? "" : sourceTeamId(match.team2),
          team_a_label: match.team1 || "TBD",
          team_b_label: match.team2 || "TBD",
          score_a: goalScore[0] ?? "",
          score_b: goalScore[1] ?? "",
          penalty_a: penaltyScore[0] ?? "",
          penalty_b: penaltyScore[1] ?? "",
        };
      }),
    };
  }

  function matchSortTime(match) {
    if (!match.date) return Number.POSITIVE_INFINITY;

    const time = String(match.time || "00:00").match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d{1,2}))?/);
    if (!time) return Date.parse(`${match.date}T00:00:00Z`);

    const hours = Number(time[1]);
    const minutes = Number(time[2]);
    const offset = time[3] ? Number(time[3]) : 0;
    return Date.UTC(
      Number(match.date.slice(0, 4)),
      Number(match.date.slice(5, 7)) - 1,
      Number(match.date.slice(8, 10)),
      hours - offset,
      minutes,
    );
  }

  function scoringMap() {
    return Object.fromEntries(state.scoring.map((rule) => [rule.event, Number(rule.points) || 0]));
  }

  function scoreValue(event) {
    return scoringMap()[event] || 0;
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

    const rawPenaltyFor = isA ? match.penalty_a : match.penalty_b;
    const rawPenaltyAgainst = isA ? match.penalty_b : match.penalty_a;
    const penaltyFor = Number(rawPenaltyFor);
    const penaltyAgainst = Number(rawPenaltyAgainst);
    const hasPenalties =
      rawPenaltyFor !== "" &&
      rawPenaltyAgainst !== "" &&
      !Number.isNaN(penaltyFor) &&
      !Number.isNaN(penaltyAgainst);
    const resultFor = hasPenalties ? penaltyFor : goalsFor;
    const resultAgainst = hasPenalties ? penaltyAgainst : goalsAgainst;

    return {
      played: 1,
      wins: resultFor > resultAgainst ? 1 : 0,
      draws: resultFor === resultAgainst && !hasPenalties ? 1 : 0,
      losses: resultFor < resultAgainst ? 1 : 0,
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
      matchPoints: 0,
      groupBonus: 0,
      progressBonus: 0,
      tierBonus: 0,
      upsetBonus: 0,
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
      matchPoints: 0,
      groupBonus: 0,
      progressBonus: 0,
      tierBonus: 0,
      upsetBonus: 0,
      points: 0,
    };
  }

  function scoreTeam(team) {
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
      const matchPoints = pointsForMatch(match, team.id);
      stats.matchPoints += matchPoints || 0;
      stats.points += matchPoints || 0;
    }

    const bonuses = tournamentBonusesForTeam(team);
    stats.groupBonus = bonuses.groupBonus;
    stats.progressBonus = bonuses.progressBonus;
    stats.tierBonus = bonuses.tierBonus;
    stats.upsetBonus = bonuses.upsetBonus;
    stats.points += bonuses.groupBonus + bonuses.progressBonus + bonuses.tierBonus;
    return stats;
  }

  function calculateStandings() {
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
        const teamStats = scoreTeam(team);
        standing.played += teamStats.played;
        standing.wins += teamStats.wins;
        standing.draws += teamStats.draws;
        standing.losses += teamStats.losses;
        standing.goalsFor += teamStats.goalsFor;
        standing.goalsAgainst += teamStats.goalsAgainst;
        standing.cleanSheets += teamStats.cleanSheets;
        standing.matchPoints += teamStats.matchPoints;
        standing.groupBonus += teamStats.groupBonus;
        standing.progressBonus += teamStats.progressBonus;
        standing.tierBonus += teamStats.tierBonus;
        standing.upsetBonus += teamStats.upsetBonus;
        standing.points += teamStats.points;
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

  function decoratePlayers(players) {
    return players.map((player, index) => ({
      ...player,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    }));
  }

  function setPlayerColor(node, player) {
    if (player?.color) node.style.setProperty("--player-color", player.color);
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
    pill.appendChild(tierBadge(team));
    pill.appendChild(el("span", "", team.name));
    if (team.fifaRank) {
      pill.appendChild(el("span", "worldcup-pill-rank", `#${team.fifaRank}`));
      pill.title = `${team.name} - FIFA rank ${team.fifaRank}${team.fifaPoints ? `, ${team.fifaPoints} pts` : ""}`;
    }
    return pill;
  }

  function teamName(team, fallback) {
    if (!team) return fallback;
    return `${team.flag || "⚽"} ${tierCode(team.tier)} ${team.name}`;
  }

  function renderTeamName(team, fallback) {
    const wrapper = el("span", "worldcup-team-name");
    if (team) {
      wrapper.appendChild(el("span", "worldcup-team-flag", team.flag || "⚽"));
      wrapper.appendChild(tierBadge(team));
      wrapper.appendChild(el("span", "worldcup-team-label", team.name));
      return wrapper;
    }
    wrapper.appendChild(el("span", "worldcup-team-label", fallback || "TBD"));
    return wrapper;
  }

  function tierLabel(tier) {
    if (tier === "top") return "Big Guns";
    if (tier === "middle") return "Wild Cards";
    if (tier === "longshot") return "Chaos Picks";
    if (tier === "unseeded") return "Unseeded";
    return `${tier[0].toUpperCase()}${tier.slice(1)} tier`;
  }

  function tierShortLabel(tier) {
    if (tier === "top") return "big gun";
    if (tier === "middle") return "wild card";
    if (tier === "longshot") return "chaos pick";
    return tier;
  }

  function tierCode(tier) {
    if (tier === "top") return "T1";
    if (tier === "middle") return "T2";
    if (tier === "longshot") return "T3";
    return "T?";
  }

  function tierBadge(team) {
    const badge = el("span", `worldcup-team-tier worldcup-team-tier-${team?.tier || "unseeded"}`, tierCode(team?.tier));
    badge.title = tierLabel(team?.tier || "unseeded");
    return badge;
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

    const scores = calculatePlayerScores();
    scores.forEach((score, index) => {
      const card = el("article", `worldcup-player-score-card ${index === 0 && score.teams.length ? "worldcup-player-score-leader" : ""}`);
      setPlayerColor(card, score.player);
      const header = el("div", "worldcup-player-score-header");
      const rank = el("span", "worldcup-player-rank", index === 0 && score.teams.length ? "Leader" : `#${index + 1}`);
      const title = document.createElement("h3");
      title.textContent = score.player.name;
      header.appendChild(rank);
      header.appendChild(title);
      header.appendChild(el("strong", "", `${score.total} pts`));
      card.appendChild(header);
      card.appendChild(el("div", "worldcup-player-status", standingStatus(score, index, scores)));

      const teamList = el("div", "worldcup-team-score-list");
      for (const teamStats of score.teams) {
        const row = el("div", "worldcup-team-score-row");
        const teamName = el("span", "", teamNameWithTier(teamStats.team));
        const bonusPoints = teamStats.groupBonus + teamStats.progressBonus + teamStats.tierBonus;
        const bonusText = bonusPoints > 0 ? `, bonuses +${bonusPoints}` : "";
        const record = el(
          "small",
          "",
          `${teamStats.points} pts - matches +${teamStats.matchPoints}${bonusText}; ${teamStats.wins}W ${teamStats.draws}D ${teamStats.losses}L, ${teamStats.goalsFor} GF, ${teamStats.cleanSheets} CS`,
        );
        row.appendChild(teamName);
        row.appendChild(record);
        teamList.appendChild(row);
      }
      if (score.teams.length === 0) {
        teamList.appendChild(el("div", "worldcup-team-score-empty", "Waiting for draw night"));
      }
      card.appendChild(teamList);
      list.appendChild(card);
    });
  }

  function standingStatus(score, index, scores) {
    if (score.teams.length === 0) return "Waiting for draw night";
    if (index === 0) return "Current leader";
    if (index <= 2) return "Chasing pack";
    if (index >= scores.length - 2) return "Needs a miracle";
    return "Still in the hunt";
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
      setPlayerColor(slot, player);
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
      { title: "Results In", matches: sortMatchesByTime(state.matches.filter(matchIsPlayed)) },
      { title: "Games To Watch", matches: sortMatchesByTime(state.matches.filter((match) => !matchIsPlayed(match))) },
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
        details.className = "worldcup-match-details";
        details.appendChild(renderMatchTeams(match, teamA, teamB, owners));
        details.appendChild(el("div", "worldcup-match-meta", matchMeta(match)));
        item.appendChild(details);
        item.appendChild(el("div", "worldcup-score", matchScoreLabel(match)));
        matches.appendChild(item);
      }

      section.appendChild(matches);
      list.appendChild(section);
    }
  }

  function renderGroupStandings() {
    const list = app.querySelector("[data-group-standings]");
    if (!list) return;

    const teams = byId(state.teams);
    const groups = [...groupStandings().entries()].sort(([groupA], [groupB]) => groupA.localeCompare(groupB));
    list.innerHTML = "";

    if (groups.length === 0) {
      list.appendChild(el("div", "worldcup-empty-panel", "Group standings will appear once the fixture data loads."));
      return;
    }

    for (const [groupName, group] of groups) {
      const card = el("section", "worldcup-group-card");
      card.appendChild(el("h3", "", groupName));

      const table = el("table", "worldcup-group-table");
      const thead = document.createElement("thead");
      const header = document.createElement("tr");
      for (const label of ["Team", "P", "W-D-L", "GD", "Pts"]) {
        header.appendChild(el("th", "", label));
      }
      thead.appendChild(header);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of group.rows) {
        const team = teams.get(row.teamId);
        const tr = document.createElement("tr");
        if (row.played > 0 && row.rank <= 2) tr.classList.add("worldcup-group-qualifier");

        const teamCell = document.createElement("td");
        teamCell.appendChild(renderGroupTeamName(team, row.teamId, row.rank));
        tr.appendChild(teamCell);
        tr.appendChild(el("td", "", row.played));
        tr.appendChild(el("td", "", `${row.wins}-${row.draws}-${row.losses}`));
        tr.appendChild(el("td", "", row.goalsFor - row.goalsAgainst));
        tr.appendChild(el("td", "worldcup-group-points", row.footballPoints));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);

      const wrap = el("div", "worldcup-group-table-wrap");
      wrap.appendChild(table);
      card.appendChild(wrap);
      list.appendChild(card);
    }
  }

  function renderGroupTeamName(team, fallback, rank) {
    const wrapper = el("span", "worldcup-group-team-name");
    wrapper.appendChild(el("span", "worldcup-group-rank", rank));
    if (team) {
      wrapper.appendChild(el("span", "worldcup-group-team-flag", team.flag || "⚽"));
      wrapper.appendChild(tierBadge(team));
      wrapper.appendChild(el("span", "worldcup-group-team-label", team.name));
      return wrapper;
    }
    wrapper.appendChild(el("span", "worldcup-group-team-label", fallback || "TBD"));
    return wrapper;
  }

  function sortMatchesByTime(matches) {
    return [...matches].sort((a, b) => {
      if (a.sort_time !== b.sort_time) return a.sort_time - b.sort_time;
      return a.id.localeCompare(b.id);
    });
  }

  function renderNextUp() {
    const list = app.querySelector("[data-next-up-list]");
    if (!list) return;

    const teams = byId(state.teams);
    const owners = teamOwnerMap();
    list.innerHTML = "";

    if (owners.size === 0) {
      list.appendChild(el("div", "worldcup-empty-panel", "Run the draw to reveal the assigned fixtures."));
      return;
    }

    const familyMatches = state.matches
      .filter((match) => !matchIsPlayed(match))
      .filter((match) => owners.has(match.team_a) || owners.has(match.team_b))
      .sort((a, b) => a.sort_time - b.sort_time);

    const now = Date.now();
    const futureMatches = familyMatches.filter((match) => match.sort_time >= now);
    const upcoming = (futureMatches.length ? futureMatches : familyMatches).slice(0, 4);

    if (upcoming.length === 0) {
      list.appendChild(el("div", "worldcup-empty-panel", "No assigned fixtures left to play."));
      return;
    }

    for (const match of upcoming) {
      const teamA = teams.get(match.team_a);
      const teamB = teams.get(match.team_b);
      const card = el("article", "worldcup-next-up-card");
      card.appendChild(renderMatchTeams(match, teamA, teamB, owners));
      card.appendChild(el("div", "worldcup-match-meta", matchMeta(match)));
      list.appendChild(card);
    }
  }

  function renderMatchTeams(match, teamA, teamB, owners) {
    const row = el("div", "worldcup-match-teams");
    row.appendChild(renderMatchTeamColumn(match, teamA, match.team_a_label, owners.get(teamA?.id)));
    row.appendChild(el("span", "worldcup-match-versus", "vs"));
    row.appendChild(renderMatchTeamColumn(match, teamB, match.team_b_label, owners.get(teamB?.id)));
    return row;
  }

  function renderMatchTeamColumn(match, team, fallbackLabel, owner) {
    const column = el("div", "worldcup-match-team-column");
    const title = el("h3", "worldcup-match-title");
    title.appendChild(renderTeamName(team, fallbackLabel));
    column.appendChild(title);

    const ownerName = team ? owner?.name || "Unassigned" : "Pending team";
    const points = team ? pointsForMatch(match, team.id) : null;
    const pointsText = points === null ? "pending" : `+${points} pts`;
    const ownerBadge = el("span", `worldcup-match-owner ${owner ? "worldcup-match-owner-assigned" : ""}`);
    setPlayerColor(ownerBadge, owner);
    ownerBadge.appendChild(el("strong", "worldcup-match-owner-name", ownerName));
    ownerBadge.appendChild(el("span", "worldcup-match-owner-points", pointsText));
    column.appendChild(ownerBadge);
    return column;
  }

  function teamNameWithTier(team) {
    const rank = team.fifaRank ? `, FIFA #${team.fifaRank}` : "";
    return `${teamName(team, "Team")} (${tierShortLabel(team.tier)}${rank})`;
  }

  function matchMeta(match) {
    return [matchStageLabel(match), localKickoffLabel(match), match.ground].filter(Boolean).join(" - ");
  }

  function matchStageLabel(match) {
    if (match.group && /^Matchday\s+\d+$/i.test(match.round || "")) return match.group;
    return match.stage;
  }

  function localKickoffLabel(match) {
    if (!Number.isFinite(match.sort_time)) {
      return [match.date, match.time].filter(Boolean).join(" ");
    }

    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(match.sort_time));
  }

  function matchScoreLabel(match) {
    if (!matchIsPlayed(match)) return "TBD";
    const score = `${match.score_a}-${match.score_b}`;
    if (match.penalty_a !== "" && match.penalty_b !== "") return `${score} pens ${match.penalty_a}-${match.penalty_b}`;
    return score;
  }

  function pointsForMatch(match, teamId) {
    const result = resultFor(match, teamId);
    if (!result) return null;

    return (
      result.wins * scoreValue("win") +
      result.draws * scoreValue("draw") +
      result.goalsFor * scoreValue("goal_for") +
      result.cleanSheets * scoreValue("clean_sheet") +
      upsetBonusForMatch(match, teamId)
    );
  }

  function tournamentBonusesForTeam(team) {
    const groupProfile = groupProfileForTeam(team.id);
    const progress = progressProfileForTeam(team.id);
    const groupBonus =
      (groupProfile.qualified ? scoreValue("group_qualify") : 0) +
      (groupProfile.groupWinner ? scoreValue("group_winner") : 0) +
      (groupProfile.groupUnbeaten ? scoreValue("group_unbeaten") : 0);
    const progressBonus = scoreValue(progress.event);
    const tierBonus = tierBonusForTeam(team, groupProfile, progress);
    const upsetBonus = state.matches.reduce((sum, match) => sum + upsetBonusForMatch(match, team.id), 0);

    return { groupBonus, progressBonus, tierBonus, upsetBonus };
  }

  function groupProfileForTeam(teamId) {
    const groups = groupStandings();
    const teamGroup = [...groups.values()].find((group) => group.rows.some((row) => row.teamId === teamId));
    if (!teamGroup) return { qualified: false, groupWinner: false, groupUnbeaten: false };

    const row = teamGroup.rows.find((candidate) => candidate.teamId === teamId);
    const qualifiedFromKnockout = progressProfileForTeam(teamId).stage !== "group_stage";
    const qualifiedFromGroup = teamGroup.complete && (row.rank <= 2 || thirdPlaceQualifiers().has(teamId));

    return {
      qualified: qualifiedFromKnockout || qualifiedFromGroup,
      groupWinner: teamGroup.complete && row.rank === 1,
      groupUnbeaten: teamGroup.complete && row.played > 0 && row.losses === 0,
    };
  }

  function groupStandings() {
    const groupMatches = state.matches.filter((match) => match.group && match.team_a && match.team_b);
    const matchesByGroup = new Map();
    for (const match of groupMatches) {
      if (!matchesByGroup.has(match.group)) matchesByGroup.set(match.group, []);
      matchesByGroup.get(match.group).push(match);
    }

    const groups = new Map();
    for (const [group, matches] of matchesByGroup) {
      const rows = new Map();
      for (const match of matches) {
        for (const teamId of [match.team_a, match.team_b]) {
          if (!rows.has(teamId)) {
            rows.set(teamId, {
              teamId,
              played: 0,
              footballPoints: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              goalsFor: 0,
              goalsAgainst: 0,
            });
          }
        }
      }

      for (const match of matches) {
        for (const teamId of [match.team_a, match.team_b]) {
          const result = resultFor(match, teamId);
          if (!result) continue;
          const row = rows.get(teamId);
          row.played += 1;
          row.wins += result.wins;
          row.draws += result.draws;
          row.losses += result.losses;
          row.goalsFor += result.goalsFor;
          row.goalsAgainst += result.goalsAgainst;
          row.footballPoints += result.wins * 3 + result.draws;
        }
      }

      const sortedRows = [...rows.values()].sort((a, b) => {
        const goalDifferenceA = a.goalsFor - a.goalsAgainst;
        const goalDifferenceB = b.goalsFor - b.goalsAgainst;
        if (b.footballPoints !== a.footballPoints) return b.footballPoints - a.footballPoints;
        if (goalDifferenceB !== goalDifferenceA) return goalDifferenceB - goalDifferenceA;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return teamNameById(a.teamId).localeCompare(teamNameById(b.teamId));
      });

      sortedRows.forEach((row, index) => {
        row.rank = index + 1;
      });

      groups.set(group, {
        complete: matches.every(matchIsPlayed),
        rows: sortedRows,
      });
    }

    return groups;
  }

  function thirdPlaceQualifiers() {
    const groups = [...groupStandings().values()];
    if (groups.length === 0 || groups.some((group) => !group.complete)) return new Set();

    return new Set(
      groups
        .map((group) => group.rows[2])
        .filter(Boolean)
        .sort((a, b) => {
          const goalDifferenceA = a.goalsFor - a.goalsAgainst;
          const goalDifferenceB = b.goalsFor - b.goalsAgainst;
          if (b.footballPoints !== a.footballPoints) return b.footballPoints - a.footballPoints;
          if (goalDifferenceB !== goalDifferenceA) return goalDifferenceB - goalDifferenceA;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          return teamNameById(a.teamId).localeCompare(teamNameById(b.teamId));
        })
        .slice(0, 8)
        .map((row) => row.teamId),
    );
  }

  function teamNameById(teamId) {
    return byId(state.teams).get(teamId)?.name || teamId;
  }

  function progressProfileForTeam(teamId) {
    const progressByStage = {
      group_stage: { order: 0, event: "" },
      last_32: { order: 1, event: "progress_last_32" },
      last_16: { order: 2, event: "progress_last_16" },
      quarter_final: { order: 3, event: "progress_quarter_final" },
      semi_final: { order: 4, event: "progress_semi_final" },
      final: { order: 5, event: "progress_final" },
      winner: { order: 6, event: "progress_winner" },
    };

    let best = "group_stage";
    for (const match of state.matches) {
      if (match.team_a !== teamId && match.team_b !== teamId) continue;
      const stage = stageFromRound(match.stage);
      if (progressByStage[stage].order > progressByStage[best].order) best = stage;
      if (stage === "final" && resultFor(match, teamId)?.wins) best = "winner";
    }

    return { stage: best, ...progressByStage[best] };
  }

  function stageFromRound(stage) {
    const normalized = String(stage || "").toLowerCase();
    if (normalized.includes("final") && !normalized.includes("semi") && !normalized.includes("third")) return "final";
    if (normalized.includes("semi")) return "semi_final";
    if (normalized.includes("quarter")) return "quarter_final";
    if (normalized.includes("round of 16")) return "last_16";
    if (normalized.includes("round of 32")) return "last_32";
    return "group_stage";
  }

  function stageReached(progress, stage) {
    const order = {
      group_stage: 0,
      last_32: 1,
      last_16: 2,
      quarter_final: 3,
      semi_final: 4,
      final: 5,
      winner: 6,
    };
    return order[progress.stage] >= order[stage];
  }

  function tierBonusForTeam(team, groupProfile, progress) {
    const tierNumber = tierNumberForTeam(team);
    if (tierNumber === 1) return 0;

    let total = 0;
    if (groupProfile.qualified) total += scoreValue(`tier_${tierNumber}_group_qualify`);
    if (stageReached(progress, "quarter_final")) total += scoreValue(`tier_${tierNumber}_quarter_final`);
    if (stageReached(progress, "semi_final")) total += scoreValue(`tier_${tierNumber}_semi_final`);
    if (stageReached(progress, "final")) total += scoreValue(`tier_${tierNumber}_final`);
    if (progress.stage === "winner") total += scoreValue(`tier_${tierNumber}_winner`);
    return total;
  }

  function tierNumberForTeam(team) {
    if (team?.tier === "top") return 1;
    if (team?.tier === "middle") return 2;
    if (team?.tier === "longshot") return 3;
    return 1;
  }

  function upsetBonusForMatch(match, teamId) {
    const result = resultFor(match, teamId);
    if (!result?.wins) return 0;

    const teams = byId(state.teams);
    const team = teams.get(teamId);
    const opponent = teams.get(match.team_a === teamId ? match.team_b : match.team_a);
    if (!team || !opponent) return 0;

    const teamTier = tierNumberForTeam(team);
    const opponentTier = tierNumberForTeam(opponent);
    if (teamTier <= opponentTier) return 0;

    if (teamTier === 2 && opponentTier === 1) return scoreValue("upset_tier_2_over_1");
    if (teamTier === 3 && opponentTier === 2) return scoreValue("upset_tier_3_over_2");
    if (teamTier === 3 && opponentTier === 1) return scoreValue("upset_tier_3_over_1");
    return 0;
  }

  function renderRules() {
    const list = app.querySelector("[data-rules-list]");
    list.innerHTML = "";
    for (const rule of state.scoring) {
      const row = el("div", "worldcup-rule-tile");
      const header = el("div", "worldcup-rule-header");
      header.appendChild(el("dt", "", rule.label));
      header.appendChild(el("dd", "", `+${rule.points}`));
      row.appendChild(header);
      if (rule.description) row.appendChild(el("p", "worldcup-rule-description", rule.description));
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
    const seed = "worldcup";
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
    setStatus("Drawing teams...");

    try {
      for (const assignment of generatedAssignments) {
        await dealTeamToPlayer(assignment);
      }

      state.assignments = generatedAssignments.map((assignment) => ({
        player_id: assignment.player.id,
        team_id: assignment.team.id,
      }));
      renderSummary();
      renderNextUp();
      renderPlayerScores();
      renderMatchBoard();
      renderDrawTiers(new Set(generatedAssignments.map((assignment) => assignment.team.id)));
      output.value = rows.join("\n");
      outputPanel.hidden = false;
      setStatus(`Generated draw and updated the tracker from ${state.sourceName}.`);
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
    renderNextUp();
    renderRules();
    renderPlayerScores();
    renderGroupStandings();
    renderMatchBoard();
  }

  async function init() {
    try {
      const [players, tiers, assignments, scoring, worldCupSource] = await Promise.all([
        loadCsv(DATA_FILES.players),
        loadCsv(DATA_FILES.tiers),
        loadCsv(DATA_FILES.assignments),
        loadCsv(DATA_FILES.scoring),
        loadWorldCupJson(),
      ]);
      const sourceData = normalizeWorldCupData(worldCupSource, tiers);
      Object.assign(state, { players: decoratePlayers(players), tiers, assignments, scoring, ...sourceData });
      render();
      app.querySelector("[data-run-draw]").addEventListener("click", runDraw);
      setStatus(`Competition data loaded from ${state.sourceName}.`);
    } catch (error) {
      console.error(error);
      setStatus("Could not load competition data. Check the local CSV files, openfootball source, and browser console.");
    }
  }

  init();
})();
