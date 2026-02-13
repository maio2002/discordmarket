module.exports = {
  XP: {
    PER_MESSAGE: 12,
    PER_VOICE_MINUTE: 12,
    MESSAGE_COOLDOWN_MS: 30_000,
    VOICE_MIN_USERS: 2,
    LEVEL_FORMULA_BASE: 100,
    LEVEL_FORMULA_EXPONENT: 1.5,
    MAX_LEVEL: 50,
  },
  COINS: {
    INITIAL_BALANCE: 200,
    ROLE_PRICE_DEFAULT: 250,
    OWN_ROLE_BASE_COST: 2250,
    OWN_ROLE_SUPPORTER_COST: 250,
    OWN_ROLE_INCREMENT: 1000,
    PRESTIGE_COST: 6000,
    ROLE_BUY_COOLDOWN_MS: 20 * 60_000,
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
};
