// Все игровые коэффициенты — только здесь. Не хардкодить в логике.

export const GAME_CONFIG = {
  mash: {
    effDefault: 0.8,
    tempFactor: {
      '63-64': 1.05,
      '65-67': 1.0,
      '68-70': 0.93,
    },
  },

  hops: {
    utilization: {
      bittering_60min: 0.21,
      flavor_15min: 0.12,
      aroma_5min: 0.05,
      dry_hop: 0.0,
    },
  },

  brew: {
    srmK: 5.0,
    srmExp: 0.69,
    abvFactor: 131.25,
    // "1.65 * 0.000125^(OG-1)" — аппроксимация для FG
  },

  process: {
    weights: {
      mash: 0.3,
      hops: 0.3,
      chill: 0.15,
      ferment: 0.25,
    },
  },

  quality: {
    weights: {
      stylMatch: 0.5,
      process: 0.3,
      balance: 0.2,
    },
    bonusWater: 2,
    kOff: 8,
    kBal: 30,
    kOut: 40,
    bonusCenter: 10,
    randomR0: 6,
  },

  price: {
    // итоговая цена = base * qualityMult * demandMult * reputationMult
    qualityMultMin: 0.5,
    qualityMultMax: 2.0, // 0.5 + quality/100 * 1.5
    demandMultRange: [0.7, 1.5] as [number, number],
    reputationMultRange: [1.0, 1.3] as [number, number],
  },

  xp: {
    perBrewFormula: 'round(quality*0.5 + volume_l*0.5 + new_style_bonus)',
    newStyleBonus: 10,
    toLevel: (level: number) => Math.round(100 * Math.pow(level, 1.5)),
  },

  rating: {
    initialElo: 1000,
  },
} as const
