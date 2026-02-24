module.exports = {
  COINS: {
    INITIAL_BALANCE: 200,
    PER_MESSAGE_MIN: 8,
    PER_MESSAGE_MAX: 16,
    PER_VOICE_MIN: 8,
    PER_VOICE_MAX: 16,
    MESSAGE_COOLDOWN_MS: 30_000,
    VOICE_MIN_USERS: 2,
    ROLE_PRICE_DEFAULT: 250,
    OWN_ROLE_BASE_COST: 2250,
    OWN_ROLE_SUPPORTER_COST: 250,
    OWN_ROLE_INCREMENT: 1000,
    ROLE_BUY_COOLDOWN_MS: 20 * 60_000,
  },
  LEVEL: {
    MAX_LEVEL: 9,
    RANKS: [
      { name: 'Bauer',       cost: 200 },
      { name: 'Handwerker',  cost: 500 },
      { name: 'Händler',     cost: 1000 },
      { name: 'Bürger',      cost: 2000 },
      { name: 'Ritter',      cost: 4000 },
      { name: 'Mönch',       cost: 7000 },
      { name: 'Priester',    cost: 12000 },
      { name: 'Graf',        cost: 20000 },
      { name: 'König',       cost: 35000 },
    ],
  },
  WEEKLY_BONUSES: {
    MEMBER: 2000,
    VIP: 4000,
  },
  JOB_SALARIES: {
    moderator: 7000,
    support: 5000,
    advertisement: 3000,
    examiner: 4000,
  },
  SPEAKER: {
    DEFAULT_PAYOUT: 5000,
  },
  EXAM_OUTCOMES: {
    BESTANDEN: 'bestanden',
    MITTLE_DING: 'mittle_ding',
    VERKACKT: 'verkackt',
  },
  EXAM_COIN_REWARDS: {
    bestanden: 1.0,
    mittle_ding: 0.5,
    verkackt: 0,
  },
  SERVERRAT: {
    VOTE_DURATION_HOURS: 48,
    QUORUM: 2,             // Mindestanzahl Gilden-Stimmen für gültiges Ergebnis
    PASS_THRESHOLD: 0.5,   // >50% Ja-Stimmen = angenommen
    ELECTION_NOMINATION_HOURS: 24,
    ELECTION_VOTE_HOURS: 24,
  },
  SEATS: {
    MAX_SEATS:      67,
    ELECTION_DAYS:  7,   // Wie viele Tage die Wahl läuft
  },
  GUILD: {
    FOUND_COST: 5000,
    LEVELS: [
      { name: 'Neuling',     threshold: 0 },
      { name: 'Siedlung',    threshold: 1_000 },
      { name: 'Dorf',        threshold: 5_000 },
      { name: 'Stadt',       threshold: 15_000 },
      { name: 'Festung',     threshold: 40_000 },
      { name: 'Kaiserreich', threshold: 100_000 },
    ],
  },
};