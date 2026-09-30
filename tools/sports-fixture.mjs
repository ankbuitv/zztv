// ============================================================================
// SPORTS
// ----------------------------------------------------------------------------
// The Sports page reads through /api/sports/tsdb (TheSportsDB v1 shape) and
// /api/sports/espn (ESPN scoreboard shape). Neither upstream is reachable from
// the sandbox, so this stands in for both.
//
// Two things matter about the shape of this data, because they are product
// requirements rather than fixture details:
//
//   - It is NOT football-only. all_leagues.php spans a dozen sports, which is
//     what drives the sports index on the page. If the fixture only had soccer,
//     a football-only layout would look correct here and break in production.
//
//   - Badges point at /img/... instead of the real CDN, for the same reason the
//     channel logos do: the upstream hosts are unreachable, and a screen full of
//     broken images tells you nothing about the layout.
//
// Fixtures are generated relative to the current time, so there is always a
// live match, recent results and upcoming fixtures to look at. Deterministic:
// same league always produces the same teams and scores.
// ============================================================================

/**
 * The fixture shares the host's string hash, so everything is built inside a
 * factory rather than at module scope. Generated IDs and badge seeds then stay
 * consistent with the rest of the fixture instead of drifting.
 */
export function createSports(hash) {
const teamBadge = (league, team) =>
  `/img/w185/t${hash(`${league.id}:${team}`).toString(36)}.png`;

const SPORTS_LEAGUES = [
  {
    id: '4328', name: 'English Premier League', short: 'EPL', sport: 'Soccer', country: 'England',
    venue: 'Premier League Stadium',
    teams: ['Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 'Chelsea', 'Crystal Palace',
      'Everton', 'Fulham', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
      'Nottingham Forest', 'Tottenham', 'West Ham', 'Wolves', 'Leicester City', 'Ipswich Town', 'Southampton'],
  },
  {
    id: '4335', name: 'Spanish La Liga', short: 'LaLiga', sport: 'Soccer', country: 'Spain',
    venue: 'LaLiga Ground',
    teams: ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Athletic Club', 'Real Sociedad', 'Villarreal',
      'Real Betis', 'Sevilla', 'Valencia', 'Girona', 'Osasuna', 'Celta Vigo', 'Rayo Vallecano', 'Getafe',
      'Mallorca', 'Alaves', 'Las Palmas', 'Espanyol', 'Leganes', 'Valladolid'],
  },
  {
    id: '4332', name: 'Italian Serie A', short: 'Serie A', sport: 'Soccer', country: 'Italy',
    venue: 'Serie A Stadium',
    teams: ['Inter', 'AC Milan', 'Juventus', 'Napoli', 'Atalanta', 'Roma', 'Lazio', 'Fiorentina', 'Bologna',
      'Torino', 'Udinese', 'Genoa', 'Monza', 'Lecce', 'Empoli', 'Verona', 'Cagliari', 'Parma',
      'Como', 'Venezia'],
  },
  {
    id: '4331', name: 'German Bundesliga', short: 'Bundesliga', sport: 'Soccer', country: 'Germany',
    venue: 'Bundesliga Arena',
    teams: ['Bayern Munich', 'Bayer Leverkusen', 'Borussia Dortmund', 'RB Leipzig', 'Stuttgart',
      'Eintracht Frankfurt', 'Hoffenheim', 'Freiburg', 'Union Berlin', 'Werder Bremen', 'Wolfsburg',
      'Mainz 05', 'Augsburg', 'Bochum', 'Heidenheim', 'St Pauli', 'Holstein Kiel', 'Monchengladbach'],
  },
  {
    id: '4334', name: 'French Ligue 1', short: 'Ligue 1', sport: 'Soccer', country: 'France',
    venue: 'Ligue 1 Stadium',
    teams: ['Paris SG', 'Marseille', 'Monaco', 'Lille', 'Lyon', 'Lens', 'Nice', 'Rennes', 'Brest',
      'Strasbourg', 'Toulouse', 'Nantes', 'Reims', 'Montpellier', 'Auxerre', 'Angers', 'Le Havre',
      'Saint-Etienne'],
  },
  {
    id: '4480', name: 'UEFA Champions League', short: 'UCL', sport: 'Soccer', country: 'Europe', cup: true,
    venue: 'European Night',
    teams: ['Real Madrid', 'Manchester City', 'Bayern Munich', 'Paris SG', 'Inter', 'Barcelona', 'Arsenal',
      'Atletico Madrid', 'Borussia Dortmund', 'RB Leipzig', 'Liverpool', 'AC Milan', 'Napoli', 'Porto',
      'Benfica', 'Ajax', 'PSV', 'Celtic', 'Feyenoord', 'Club Brugge'],
  },
  {
    id: '4803', name: 'Vietnamese V.League 1', short: 'V.League 1', sport: 'Soccer', country: 'Vietnam',
    venue: 'San van dong quoc gia',
    teams: ['Ha Noi FC', 'Cong An Ha Noi', 'Hoang Anh Gia Lai', 'Becamex Binh Duong', 'Song Lam Nghe An',
      'Thanh Hoa', 'Hai Phong', 'Nam Dinh', 'Da Nang', 'Khanh Hoa', 'Quang Nam', 'Binh Dinh',
      'Ho Chi Minh City', 'Dong A Thanh Hoa'],
  },
  {
    id: '5642', name: 'FIFA U-20 World Cup', short: 'U20 WC', sport: 'Soccer', country: 'World', cup: true,
    venue: 'World Youth Stadium',
    teams: ['Brazil U20', 'Argentina U20', 'France U20', 'Italy U20', 'Uruguay U20', 'Colombia U20',
      'Korea Republic U20', 'Japan U20', 'Nigeria U20', 'USA U20', 'Israel U20', 'Gambia U20'],
  },
  {
    id: '4387', name: 'NBA', short: 'NBA', sport: 'Basketball', country: 'USA',
    venue: 'NBA Arena',
    teams: ['Boston Celtics', 'Denver Nuggets', 'Milwaukee Bucks', 'Phoenix Suns', 'Golden State Warriors',
      'LA Lakers', 'Miami Heat', 'Dallas Mavericks', 'New York Knicks', 'Philadelphia 76ers',
      'Oklahoma City Thunder', 'Cleveland Cavaliers', 'Minnesota Timberwolves', 'Sacramento Kings'],
  },
  {
    id: '4455', name: 'NFL', short: 'NFL', sport: 'American Football', country: 'USA',
    venue: 'NFL Stadium',
    teams: ['Kansas City Chiefs', 'San Francisco 49ers', 'Baltimore Ravens', 'Detroit Lions', 'Buffalo Bills',
      'Dallas Cowboys', 'Philadelphia Eagles', 'Miami Dolphins', 'Cincinnati Bengals', 'Green Bay Packers'],
  },
  {
    id: '4424', name: 'F1 World Championship', short: 'F1', sport: 'Motorsport', country: 'World',
    venue: 'Grand Prix Circuit',
    teams: ['Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Aston Martin', 'Alpine', 'Williams',
      'RB', 'Sauber', 'Haas'],
  },
  {
    id: '4464', name: 'ATP Tour', short: 'ATP', sport: 'Tennis', country: 'World',
    venue: 'Centre Court',
    teams: ['Novak Djokovic', 'Carlos Alcaraz', 'Jannik Sinner', 'Daniil Medvedev', 'Alexander Zverev',
      'Stefanos Tsitsipas', 'Andrey Rublev', 'Holger Rune'],
  },
];

const SPORTS_BY_ID = new Map(SPORTS_LEAGUES.map((l) => [l.id, l]));

const ESPN_SLUGS = {
  '4328': 'eng.1', '4335': 'esp.1', '4332': 'ita.1', '4331': 'ger.1', '4334': 'fra.1',
  '4480': 'uefa.champions', '4803': 'vie.1', '5642': 'fifa.world.u20',
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

function isoAt(offsetMinutes) {
  return new Date(Date.now() + offsetMinutes * 60000);
}

function splitEventDate(d) {
  return {
    dateEvent: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    strTime: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`,
    strTimestamp: d.toISOString().replace(/\.\d{3}Z$/, ''),
  };
}

/**
 * One league's event list: finished results, at most one match in progress, and
 * fixtures ahead. `live` is passed in rather than derived so a caller can keep
 * the total number of live matches small — everything being live is the fastest
 * way to make a live indicator meaningless.
 */
function leagueEvents(league, { live = false } = {}) {
  const teams = league.teams;
  const out = [];
  const season = currentSeasonLabel();

  const pairAt = (i) => {
    const n = teams.length;
    const h = teams[(i * 3 + league.id.charCodeAt(0)) % n];
    return { home: h, away: teams[(i * 3 + league.id.charCodeAt(0) + 7) % n] || teams[(i + 1) % n] };
  };

  const isBasket = league.sport === 'Basketball' || league.sport === 'American Football';
  const scoreFor = (i, seed) => (isBasket
    ? [88 + (hash(`${seed}a`) % 38), 88 + (hash(`${seed}b`) % 38)]
    : [hash(`${seed}a`) % 4, hash(`${seed}b`) % 4]);

  // Finished — the last 12 results.
  for (let i = 0; i < 12; i += 1) {
    const { home, away } = pairAt(i);
    const d = isoAt(-(i * 2 + 1) * 1440 - 19 * 60);
    const seed = `${league.id}-past-${i}`;
    const [hs, as] = scoreFor(i, seed);
    out.push({
      idEvent: `fx${league.id}p${i}`,
      strEvent: `${home} vs ${away}`,
      strHomeTeam: home, strAwayTeam: away,
      intHomeScore: hs, intAwayScore: as,
      strStatus: 'FT', strPostponed: 'no',
      idLeague: league.id, strLeague: league.name, strSport: league.sport,
      strSeason: season, intRound: String(Math.max(1, 30 - i)),
      strVenue: `${league.venue} ${i + 1}`,
      strHomeTeamBadge: teamBadge(league, home), strAwayTeamBadge: teamBadge(league, away),
      ...splitEventDate(d),
    });
  }

  // In progress — exactly one per league that asked for it.
  if (live) {
    const { home, away } = pairAt(13);
    const d = isoAt(-41);
    const seed = `${league.id}-live`;
    const [hs, as] = scoreFor(0, seed);
    out.push({
      idEvent: `fx${league.id}l0`,
      strEvent: `${home} vs ${away}`,
      strHomeTeam: home, strAwayTeam: away,
      intHomeScore: isBasket ? hs : hs % 3, intAwayScore: isBasket ? as : as % 3,
      strStatus: isBasket ? 'Q3' : '2H', strPostponed: 'no',
      idLeague: league.id, strLeague: league.name, strSport: league.sport,
      strSeason: season, intRound: '31',
      strVenue: league.venue,
      strHomeTeamBadge: teamBadge(league, home), strAwayTeamBadge: teamBadge(league, away),
      ...splitEventDate(d),
    });
  }

  // Ahead — the next 12 fixtures.
  for (let i = 0; i < 12; i += 1) {
    const { home, away } = pairAt(i + 5);
    const d = isoAt((i * 2 + 1) * 1440 - 18 * 60);
    const same = home === away;
    out.push({
      idEvent: `fx${league.id}n${i}`,
      strEvent: `${same ? away : home} vs ${same ? home : away}`,
      strHomeTeam: same ? away : home, strAwayTeam: same ? home : away,
      intHomeScore: '', intAwayScore: '',
      strStatus: 'NS', strPostponed: i === 4 ? 'yes' : 'no',
      idLeague: league.id, strLeague: league.name, strSport: league.sport,
      strSeason: season, intRound: String(31 + i),
      strVenue: `${league.venue} ${i + 1}`,
      strHomeTeamBadge: teamBadge(league, same ? away : home),
      strAwayTeamBadge: teamBadge(league, same ? home : away),
      ...splitEventDate(d),
    });
  }

  return out;
}

function currentSeasonLabel() {
  const now = new Date();
  const y = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Only a few leagues are live at once. On the real feed a handful of matches run
// concurrently, never the whole board.
const LIVE_LEAGUES = new Set(['4328', '4803', '4387']);

const EVENTS_CACHE = new Map();
function eventsFor(id) {
  const league = SPORTS_BY_ID.get(String(id));
  if (!league) return [];
  // Regenerated each minute so "live" never goes stale during a long session.
  const bucket = Math.floor(Date.now() / 60000);
  const key = `${id}:${bucket}`;
  if (!EVENTS_CACHE.has(key)) {
    if (EVENTS_CACHE.size > 200) EVENTS_CACHE.clear();
    EVENTS_CACHE.set(key, leagueEvents(league, { live: LIVE_LEAGUES.has(String(id)) }));
  }
  return EVENTS_CACHE.get(key);
}

function leagueTable(league) {
  const rows = league.teams.map((name, i) => {
    const seed = `${league.id}:tbl:${name}`;
    const played = 24 + (hash(seed) % 6);
    const won = Math.max(2, Math.round(played * (0.28 + (hash(`${seed}w`) % 40) / 100)));
    const draw = hash(`${seed}d`) % Math.max(2, played - won);
    const lost = Math.max(0, played - won - draw);
    const gf = won * 2 + draw + (hash(`${seed}gf`) % 9);
    const ga = lost * 2 + draw + (hash(`${seed}ga`) % 9);
    return {
      idTeam: `t${hash(seed).toString(36)}`,
      strTeam: name,
      strTeamBadge: teamBadge(league, name),
      intPlayed: played, intWin: won, intDraw: draw, intLoss: lost,
      intGoalsFor: gf, intGoalsAgainst: ga,
      intPoints: won * 3 + draw,
      _i: i,
    };
  });
  rows.sort((a, b) => b.intPoints - a.intPoints || (b.intGoalsFor - b.intGoalsAgainst) - (a.intGoalsFor - a.intGoalsAgainst));
  return rows.map((r, i) => ({
    intRank: String(i + 1),
    idTeam: r.idTeam, strTeam: r.strTeam, strTeamBadge: r.strTeamBadge,
    intPlayed: String(r.intPlayed), intWin: String(r.intWin), intDraw: String(r.intDraw),
    intLoss: String(r.intLoss), intGoalsFor: String(r.intGoalsFor),
    intGoalsAgainst: String(r.intGoalsAgainst), intPoints: String(r.intPoints),
  }));
}

// A deliberately multi-sport index. The page builds its sport navigation from
// this, so if it only listed soccer the navigation would look fine in dev and
// silently collapse to one entry against the real API.
const LEAGUE_INDEX = [
  { strSport: 'Soccer', strLeague: 'English Premier League', idLeague: '4328', strCountry: 'England' },
  { strSport: 'Soccer', strLeague: 'Spanish La Liga', idLeague: '4335', strCountry: 'Spain' },
  { strSport: 'Soccer', strLeague: 'Italian Serie A', idLeague: '4332', strCountry: 'Italy' },
  { strSport: 'Soccer', strLeague: 'German Bundesliga', idLeague: '4331', strCountry: 'Germany' },
  { strSport: 'Soccer', strLeague: 'French Ligue 1', idLeague: '4334', strCountry: 'France' },
  { strSport: 'Soccer', strLeague: 'UEFA Champions League', idLeague: '4480', strCountry: 'Europe' },
  { strSport: 'Soccer', strLeague: 'Vietnamese V.League 1', idLeague: '4803', strCountry: 'Vietnam' },
  { strSport: 'Soccer', strLeague: 'FIFA U-20 World Cup', idLeague: '5642', strCountry: 'World' },
  { strSport: 'Soccer', strLeague: 'ASEAN Championship', idLeague: '5889', strCountry: 'Asia' },
  { strSport: 'Basketball', strLeague: 'NBA', idLeague: '4387', strCountry: 'USA' },
  { strSport: 'Basketball', strLeague: 'EuroLeague', idLeague: '4546', strCountry: 'Europe' },
  { strSport: 'American Football', strLeague: 'NFL', idLeague: '4391', strCountry: 'USA' },
  { strSport: 'Motorsport', strLeague: 'F1 World Championship', idLeague: '4370', strCountry: 'World' },
  { strSport: 'Motorsport', strLeague: 'MotoGP', idLeague: '4407', strCountry: 'World' },
  { strSport: 'Tennis', strLeague: 'ATP Tour', idLeague: '4464', strCountry: 'World' },
  { strSport: 'Tennis', strLeague: 'WTA Tour', idLeague: '4517', strCountry: 'World' },
  { strSport: 'Ice Hockey', strLeague: 'NHL', idLeague: '4380', strCountry: 'USA' },
  { strSport: 'Baseball', strLeague: 'MLB', idLeague: '4424', strCountry: 'USA' },
  { strSport: 'Rugby', strLeague: 'Six Nations', idLeague: '4458', strCountry: 'Europe' },
  { strSport: 'Golf', strLeague: 'PGA Tour', idLeague: '4430', strCountry: 'USA' },
  { strSport: 'Cricket', strLeague: 'Indian Premier League', idLeague: '4486', strCountry: 'India' },
  { strSport: 'Volleyball', strLeague: 'FIVB Nations League', idLeague: '4593', strCountry: 'World' },
  { strSport: 'Handball', strLeague: 'EHF Champions League', idLeague: '4547', strCountry: 'Europe' },
  { strSport: 'Cycling', strLeague: 'Tour de France', idLeague: '4524', strCountry: 'France' },
  { strSport: 'Fighting', strLeague: 'UFC', idLeague: '4443', strCountry: 'World' },
  { strSport: 'Esports', strLeague: 'League of Legends World Championship', idLeague: '5136', strCountry: 'World' },
].map((l) => ({
  ...l,
  strBadge: `/img/w185/gl${hash(`${l.idLeague}`).toString(36)}.png`,
  strLogo: `/img/w342/gb${hash(`${l.idLeague}`).toString(36)}.png`,
}));

const lookupLeague = (q) => {
  const s = String(q || '').toLowerCase();
  return LEAGUE_INDEX.find((l) => l.strLeague.toLowerCase() === s)
    || LEAGUE_INDEX.find((l) => l.strLeague.toLowerCase().includes(s))
    || null;
};

/** TheSportsDB v1 stand-in. `file` is the upstream script name. */
function tsdbProxy(url) {
  const file = url.searchParams.get('file') || '';
  const id = String(url.searchParams.get('id') || '');
  const season = String(url.searchParams.get('s') || '');

  if (file === 'all_leagues.php') return { leagues: LEAGUE_INDEX };
  if (file === 'all_sports.php') {
    const sports = [...new Set(LEAGUE_INDEX.map((l) => l.strSport))];
    return { sports: sports.map((s) => ({ strSport: s, strFormat: 'TeamvsTeam' })) };
  }
  if (file === 'search_all_seasons.php') {
    const league = SPORTS_BY_ID.get(id);
    if (!league) return { seasons: [] };
    const y = new Date().getUTCFullYear();
    const seasons = league.cup
      ? [`${y - 1}`, `${y - 2}`, `${y - 3}`, `${y}`]
      : [`${y - 1}-${y}`, `${y - 2}-${y - 1}`, `${y - 3}-${y - 2}`];
    return { seasons: seasons.map((s) => ({ strSeason: s })) };
  }
  if (file === 'eventsday.php') {
    // Everything played on one calendar day, across every sport. This is what
    // the client uses to work out which leagues are actually active, so it must
    // span all sports — narrowing it to one would make the discovered list
    // football-only again.
    const day = String(url.searchParams.get('d') || '');
    const sport = String(url.searchParams.get('s') || '').toLowerCase();
    const out = [];
    for (const league of SPORTS_LEAGUES) {
      if (sport && String(league.sport).toLowerCase() !== sport) continue;
      for (const ev of eventsFor(league.id)) {
        if (day && ev.dateEvent !== day) continue;
        out.push({ ...ev, strLeagueBadge: teamBadge(league, 'badge') });
      }
    }
    return { events: out };
  }
  if (file === 'eventsnextleague.php' || file === 'eventspastleague.php' || file === 'eventsseason.php') {
    const all = eventsFor(id);
    // Season requests must cover any season the client searches for, otherwise
    // cup leagues (which try several) fall through to an empty screen.
    const list = file === 'eventsnextleague.php'
      ? all.filter((e) => e.strStatus !== 'FT')
      : file === 'eventspastleague.php'
        ? all.filter((e) => e.strStatus === 'FT')
        : all.map((e) => (season ? { ...e, strSeason: season } : e));
    return { events: list };
  }
  if (file === 'lookuptable.php') {
    const league = SPORTS_BY_ID.get(id);
    if (!league || league.cup) return { table: [] };
    return { table: leagueTable(league) };
  }
  if (file === 'lookupleague.php') {
    const league = SPORTS_BY_ID.get(id);
    return { leagues: league ? [{
      idLeague: league.id, strLeague: league.name, strSport: league.sport,
      strCountry: league.country, strCurrentSeason: currentSeasonLabel(),
      strBadge: teamBadge(league, 'badge'),
    }] : [] };
  }
  if (file === 'searchteams.php') {
    const q = String(url.searchParams.get('t') || '').toLowerCase();
    const teams = [];
    for (const league of SPORTS_LEAGUES) {
      for (const name of league.teams) {
        if (!q || name.toLowerCase().includes(q)) {
          teams.push({
            idTeam: `t${hash(`${league.id}:${name}`).toString(36)}`,
            strTeam: name, strTeamShort: name.slice(0, 3).toUpperCase(),
            strSport: league.sport, strLeague: league.name, idLeague: league.id,
            strCountry: league.country, strStadium: league.venue,
            strTeamBadge: teamBadge(league, name),
            strDescriptionEN: `${name} competes in the ${league.name}.`,
          });
        }
      }
    }
    return { teams: teams.slice(0, 20) };
  }
  if (file === 'eventslast.php' || file === 'eventsnext.php') {
    const teamId = id;
    for (const league of SPORTS_LEAGUES) {
      for (const name of league.teams) {
        if (`t${hash(`${league.id}:${name}`).toString(36)}` !== teamId) continue;
        const mine = eventsFor(league.id)
          .filter((e) => e.strHomeTeam === name || e.strAwayTeam === name)
          .filter((e) => (file === 'eventslast.php' ? e.strStatus === 'FT' : e.strStatus !== 'FT'))
          .slice(0, 5);
        return file === 'eventslast.php' ? { results: mine } : { events: mine };
      }
    }
    return file === 'eventslast.php' ? { results: [] } : { events: [] };
  }
  if (file === 'lookup_all_players.php') {
    const players = ['Nguyen Van A', 'Tran Van B', 'Le Van C', 'Pham Van D', 'Hoang Van E']
      .map((n, i) => ({
        idPlayer: `p${hash(`${id}:${i}`).toString(36)}`,
        strPlayer: n, strPosition: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'][i % 4],
        strNationality: 'Vietnam', strTeam: 'Fixture', strThumb: `/img/w185/p${hash(n).toString(36)}.png`,
      }));
    return { player: players };
  }
  if (file === 'searchplayers.php') {
    const n = url.searchParams.get('p') || 'Player';
    return { player: [{ idPlayer: `p${hash(n).toString(36)}`, strPlayer: n, strPosition: 'Midfielder', strNationality: 'Vietnam', strThumb: `/img/w185/p${hash(n).toString(36)}.png` }] };
  }
  return { _fixture: true, file, note: 'no fixture data for this file' };
}

/** ESPN scoreboard stand-in, matching the fields espnEventsToTsdb reads. */
function espnProxy(url) {
  const slug = String(url.searchParams.get('league') || '');
  const entry = Object.entries(ESPN_SLUGS).find(([, s]) => s === slug);
  if (!entry) return { events: [] };
  const league = SPORTS_BY_ID.get(entry[0]);
  if (!league) return { events: [] };

  const events = eventsFor(league.id).map((e) => {
    const state = e.strStatus === 'FT' ? 'post' : (e.strStatus === 'NS' ? 'pre' : 'in');
    const d = new Date(`${e.strTimestamp}Z`);
    return {
      id: e.idEvent.replace(/^fx/, ''),
      date: Number.isNaN(d.getTime()) ? e.strTimestamp : d.toISOString(),
      name: e.strEvent,
      shortName: `${e.strHomeTeam} v ${e.strAwayTeam}`,
      competitions: [{
        id: e.idEvent,
        venue: { fullName: e.strVenue },
        competitors: [
          {
            id: hash(`${league.id}:${e.strHomeTeam}`).toString(36), homeAway: 'home',
            score: e.intHomeScore === '' ? '0' : String(e.intHomeScore),
            winner: state === 'post' ? Number(e.intHomeScore) > Number(e.intAwayScore) : false,
            team: {
              id: hash(`${league.id}:${e.strHomeTeam}`).toString(36),
              displayName: e.strHomeTeam, shortDisplayName: e.strHomeTeam,
              abbreviation: e.strHomeTeam.slice(0, 3).toUpperCase(),
              logo: e.strHomeTeamBadge,
            },
          },
          {
            id: hash(`${league.id}:${e.strAwayTeam}`).toString(36), homeAway: 'away',
            score: e.intAwayScore === '' ? '0' : String(e.intAwayScore),
            winner: state === 'post' ? Number(e.intAwayScore) > Number(e.intHomeScore) : false,
            team: {
              id: hash(`${league.id}:${e.strAwayTeam}`).toString(36),
              displayName: e.strAwayTeam, shortDisplayName: e.strAwayTeam,
              abbreviation: e.strAwayTeam.slice(0, 3).toUpperCase(),
              logo: e.strAwayTeamBadge,
            },
          },
        ],
        status: {
          displayClock: state === 'in' ? "41'" : (state === 'post' ? 'FT' : '0\''),
          period: state === 'in' ? 2 : 0,
          type: {
            state, completed: state === 'post',
            name: e.strStatus === 'NS' && e.strPostponed === 'yes' ? 'STATUS_POSTPONED' : 'STATUS_SCHEDULED',
            description: state === 'post' ? 'Full Time' : (state === 'in' ? 'In Progress' : 'Scheduled'),
            detail: state === 'in' ? "41' - 2nd Half" : (state === 'post' ? 'FT' : 'Scheduled'),
            shortDetail: state === 'in' ? "41'" : (state === 'post' ? 'FT' : 'Scheduled'),
          },
        },
      }],
      status: {
        displayClock: state === 'in' ? "41'" : (state === 'post' ? 'FT' : '0\''),
        type: { state, description: 'Status', detail: e.strStatus, shortDetail: e.strStatus },
      },
      links: [],
      season: { year: new Date().getUTCFullYear(), type: 1, slug: 'regular-season' },
    };
  });

  return { leagues: [], events };
}

/** Highlight clips, shown as a rail on the Sports page. */
const SPORTS_VIDEOS = [
  { idVideo: 'fxv1', strTitle: 'Top 10 goals of the week', strVideo: 'https://www.youtube.com/watch?v=fixture1', strThumb: '/img/w342/v1.png', strDuration: '04:12', dateEvent: todayISO(), strSport: 'Soccer', strLeague: 'English Premier League' },
  { idVideo: 'fxv2', strTitle: 'Full match highlights: the comeback', strVideo: 'https://www.youtube.com/watch?v=fixture2', strThumb: '/img/w342/v2.png', strDuration: '08:35', dateEvent: todayISO(), strSport: 'Soccer', strLeague: 'UEFA Champions League' },
  { idVideo: 'fxv3', strTitle: 'V.League round-up', strVideo: 'https://www.youtube.com/watch?v=fixture3', strThumb: '/img/w342/v3.png', strDuration: '05:48', dateEvent: todayISO(), strSport: 'Soccer', strLeague: 'Vietnamese V.League 1' },
  { idVideo: 'fxv4', strTitle: 'NBA nightly: best plays', strVideo: 'https://www.youtube.com/watch?v=fixture4', strThumb: '/img/w342/v4.png', strDuration: '06:02', dateEvent: todayISO(), strSport: 'Basketball', strLeague: 'NBA' },
  { idVideo: 'fxv5', strTitle: 'Qualifying: the full lap', strVideo: 'https://www.youtube.com/watch?v=fixture5', strThumb: '/img/w342/v5.png', strDuration: '03:20', dateEvent: todayISO(), strSport: 'Motorsport', strLeague: 'F1 World Championship' },
  { idVideo: 'fxv6', strTitle: 'Match point: the longest rally', strVideo: 'https://www.youtube.com/watch?v=fixture6', strThumb: '/img/w342/v6.png', strDuration: '02:56', dateEvent: todayISO(), strSport: 'Tennis', strLeague: 'ATP Tour' },
];

/** Scoreboard for the "all live / recent" strip. */
function latestScores(limit = 8) {
  const out = [];
  for (const league of SPORTS_LEAGUES) {
    for (const ev of eventsFor(league.id)) {
      if (ev.strStatus === 'FT') out.push({ ...ev, _ts: Date.parse(`${ev.strTimestamp}Z`) || 0 });
    }
  }
  out.sort((a, b) => b._ts - a._ts);
  return out.slice(0, limit);
}

  return { tsdbProxy, espnProxy, SPORTS_VIDEOS, latestScores, eventsFor, SPORTS_LEAGUES, LEAGUE_INDEX };
}
