// Статические данные из beercraft_content.json (залиты в БД через seed)
// На клиенте используются для отображения каталога без лишних запросов к API

export interface IngredientData {
  key: string
  type: 'malt' | 'hop' | 'yeast' | 'water' | 'adjunct'
  name: string
  params: Record<string, unknown>
  base_price: number
  unit: string
  unlock_level: number
}

export interface StyleData {
  key: string
  name: string
  family?: string
  og?: [number, number]
  fg?: [number, number]
  abv?: [number, number]
  ibu?: [number, number]
  srm?: [number, number]
  bugu_target?: [number, number]
  base_price: number
  difficulty: number
  unlock_level: number
}

export interface WaterProfile {
  key: string
  name: string
  lean: string
  best_for: string[]
}

// Малты
export const MALTS: IngredientData[] = [
  { key: 'pale_2row',  type: 'malt', name: 'Pale Ale (2-row)',     params: { ppkg: 305, color_l: 2,   profile: 'хлебный, бисквитный' },    base_price: 6,  unit: 'kg', unlock_level: 1 },
  { key: 'crystal40',  type: 'malt', name: 'Caramel/Crystal 40',   params: { ppkg: 260, color_l: 40,  profile: 'карамель, лёгкая сладость' }, base_price: 11, unit: 'kg', unlock_level: 1 },
  { key: 'pilsner',    type: 'malt', name: 'Pilsner',               params: { ppkg: 310, color_l: 1.5, profile: 'чистый, зерновой' },         base_price: 6,  unit: 'kg', unlock_level: 2 },
  { key: 'munich',     type: 'malt', name: 'Munich',                params: { ppkg: 290, color_l: 9,  profile: 'хлебный, солодовый' },        base_price: 9,  unit: 'kg', unlock_level: 2 },
  { key: 'wheat',      type: 'malt', name: 'Wheat Malt',            params: { ppkg: 300, color_l: 2,  profile: 'лёгкий, хлебный' },           base_price: 8,  unit: 'kg', unlock_level: 1 },
  { key: 'chocolate',  type: 'malt', name: 'Chocolate Malt',        params: { ppkg: 200, color_l: 350, profile: 'шоколад, кофе' },            base_price: 18, unit: 'kg', unlock_level: 3 },
  { key: 'roasted',    type: 'malt', name: 'Roasted Barley',        params: { ppkg: 180, color_l: 500, profile: 'жжёный, кофейный' },         base_price: 15, unit: 'kg', unlock_level: 3 },
  { key: 'crystal80',  type: 'malt', name: 'Crystal 80',            params: { ppkg: 240, color_l: 80, profile: 'карамель, изюм' },            base_price: 14, unit: 'kg', unlock_level: 3 },
  { key: 'flaked_oats',type: 'malt', name: 'Flaked Oats',           params: { ppkg: 260, color_l: 1,  profile: 'кремовый, тело' },            base_price: 12, unit: 'kg', unlock_level: 4 },
]

// Хмели
export const HOPS: IngredientData[] = [
  { key: 'magnum',    type: 'hop', name: 'Magnum',    params: { alpha: 0.13, role: 'bittering', profile: 'нейтральный' },         base_price: 25, unit: '100g', unlock_level: 1 },
  { key: 'cascade',   type: 'hop', name: 'Cascade',   params: { alpha: 0.06, role: 'aroma',     profile: 'цитрус, цветочный' },     base_price: 22, unit: '100g', unlock_level: 1 },
  { key: 'citra',     type: 'hop', name: 'Citra',     params: { alpha: 0.12, role: 'aroma',     profile: 'тропики, лайм, манго' },  base_price: 35, unit: '100g', unlock_level: 2 },
  { key: 'simcoe',    type: 'hop', name: 'Simcoe',    params: { alpha: 0.13, role: 'dual',      profile: 'сосна, тропики' },        base_price: 32, unit: '100g', unlock_level: 2 },
  { key: 'hallertau', type: 'hop', name: 'Hallertau', params: { alpha: 0.04, role: 'aroma',     profile: 'травяной, пряный' },      base_price: 20, unit: '100g', unlock_level: 1 },
  { key: 'saaz',      type: 'hop', name: 'Saaz',      params: { alpha: 0.035,role: 'aroma',     profile: 'пряный, землистый' },     base_price: 20, unit: '100g', unlock_level: 1 },
  { key: 'mosaic',    type: 'hop', name: 'Mosaic',    params: { alpha: 0.115,role: 'aroma',     profile: 'ягоды, тропики, земля' }, base_price: 38, unit: '100g', unlock_level: 3 },
  { key: 'centennial',type: 'hop', name: 'Centennial',params: { alpha: 0.10, role: 'dual',      profile: 'цветочный, цитрус' },     base_price: 28, unit: '100g', unlock_level: 2 },
  { key: 'columbus',  type: 'hop', name: 'Columbus',  params: { alpha: 0.15, role: 'bittering', profile: 'землистый, острый' },     base_price: 24, unit: '100g', unlock_level: 2 },
]

// Дрожжи
export const YEASTS: IngredientData[] = [
  { key: 'us05',           type: 'yeast', name: 'US-05 American Ale',       params: { attenuation: 0.77, temp_min: 15, temp_max: 24, profile: 'чистый, нейтральный' },          base_price: 90,  unit: 'pitch', unlock_level: 1 },
  { key: 'notty',          type: 'yeast', name: 'Nottingham Ale',           params: { attenuation: 0.80, temp_min: 14, temp_max: 21, profile: 'нейтральный, сухой' },           base_price: 85,  unit: 'pitch', unlock_level: 1 },
  { key: 'wb06',           type: 'yeast', name: 'WB-06 Weizen',             params: { attenuation: 0.74, temp_min: 18, temp_max: 24, profile: 'банан, гвоздика' },              base_price: 95,  unit: 'pitch', unlock_level: 2 },
  { key: 'wheat_german',   type: 'yeast', name: 'Bavarian Wheat',           params: { attenuation: 0.76, temp_min: 18, temp_max: 22, profile: 'банан, гвоздика' },              base_price: 90,  unit: 'pitch', unlock_level: 2 },
  { key: 'wlp001',         type: 'yeast', name: 'WLP001 California Ale',    params: { attenuation: 0.76, temp_min: 18, temp_max: 23, profile: 'чистый, лёгкая фруктовость' },   base_price: 110, unit: 'pitch', unlock_level: 2 },
  { key: 's23',            type: 'yeast', name: 'S-23 Lager',               params: { attenuation: 0.78, temp_min: 8,  temp_max: 14, profile: 'чистый, свежий' },              base_price: 95,  unit: 'pitch', unlock_level: 3 },
  { key: 'german_lager',   type: 'yeast', name: 'German Lager (34/70)',     params: { attenuation: 0.75, temp_min: 9,  temp_max: 13, profile: 'чистый, отточенный' },           base_price: 70,  unit: 'pitch', unlock_level: 3 },
  { key: 'wlp530',         type: 'yeast', name: 'WLP530 Abbey Ale',         params: { attenuation: 0.77, temp_min: 18, temp_max: 26, profile: 'фруктовый, пряный' },            base_price: 120, unit: 'pitch', unlock_level: 4 },
  { key: 'english_ale',    type: 'yeast', name: 'English Ale',              params: { attenuation: 0.72, temp_min: 18, temp_max: 22, profile: 'мягко-фруктовый, солодовый' },   base_price: 55,  unit: 'pitch', unlock_level: 5 },
  { key: 'irish_ale',      type: 'yeast', name: 'Irish Ale',                params: { attenuation: 0.73, temp_min: 17, temp_max: 22, profile: 'чистый, лёгкая фруктовость' },   base_price: 55,  unit: 'pitch', unlock_level: 7 },
  { key: 'belgian_wit',    type: 'yeast', name: 'Belgian Witbier',          params: { attenuation: 0.75, temp_min: 18, temp_max: 24, profile: 'пряный, цитрусовый' },           base_price: 90,  unit: 'pitch', unlock_level: 9 },
  { key: 'belgian_saison', type: 'yeast', name: 'Belgian Saison',           params: { attenuation: 0.84, temp_min: 20, temp_max: 30, profile: 'перечный, фруктовый, сухой' },   base_price: 110, unit: 'pitch', unlock_level: 10 },
  { key: 'belgian_abbey',  type: 'yeast', name: 'Belgian Abbey/Tripel',     params: { attenuation: 0.80, temp_min: 18, temp_max: 24, profile: 'фрукты, специи, эфирный' },      base_price: 110, unit: 'pitch', unlock_level: 12 },
]

// Профили воды
export const WATER_PROFILES: WaterProfile[] = [
  { key: 'soft',       name: 'Мягкая',                lean: 'neutral',   best_for: ['pilsner', 'hefeweizen', 'witbier', 'tripel'] },
  { key: 'balanced',   name: 'Сбалансированная',      lean: 'neutral',   best_for: ['pale_ale', 'brown', 'marzen', 'saison'] },
  { key: 'hoppy',      name: 'Хмелевая (сульфатная)', lean: 'sulfate',   best_for: ['pale_ale', 'ipa'] },
  { key: 'malty',      name: 'Солодовая (хлоридная)', lean: 'chloride',  best_for: ['porter', 'neipa'] },
  { key: 'carbonate',  name: 'Карбонатная (Дублин)',  lean: 'carbonate', best_for: ['dry_stout'] },
]

// Рецептурные рекомендации по стилям (только из доступных ингредиентов)
export interface StyleRecipe {
  malts:       Array<{ key: string; name: string; amountKg: number; role: string }>
  hops:        Array<{ key: string; name: string; amountG: number; timing: string; role: string }>
  yeastKey:    string
  yeastName:   string
  waterKey:    string
  waterName:   string
  mashTempC:   number
  fermentTempC: number
  notes:       string
}

export const STYLE_RECIPES: Record<string, StyleRecipe> = {
  pale_ale: {
    malts: [
      { key: 'pale_2row',  name: 'Pale Ale (2-row)',   amountKg: 4.0, role: 'основа' },
      { key: 'crystal40',  name: 'Caramel/Crystal 40', amountKg: 0.3, role: 'карамель, цвет' },
    ],
    hops: [
      { key: 'magnum',  name: 'Magnum',  amountG: 12, timing: 'bittering', role: '⚡ горечь' },
      { key: 'cascade', name: 'Cascade', amountG: 30, timing: 'flavor',    role: '🌿 аромат' },
      { key: 'cascade', name: 'Cascade', amountG: 20, timing: 'aroma',     role: '🌸 аромат' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'hoppy', waterName: 'Хмелевая (сульфатная)',
    mashTempC: 66, fermentTempC: 19,
    notes: 'Классика: хмелевой аромат, умеренная горечь, чистый вкус.',
  },
  ipa: {
    malts: [
      { key: 'pale_2row',  name: 'Pale Ale (2-row)',   amountKg: 4.5, role: 'основа' },
      { key: 'crystal40',  name: 'Caramel/Crystal 40', amountKg: 0.3, role: 'тело, карамель' },
    ],
    hops: [
      { key: 'magnum',     name: 'Magnum',     amountG: 25, timing: 'bittering', role: '⚡ горечь' },
      { key: 'centennial', name: 'Centennial', amountG: 25, timing: 'flavor',    role: '🌿 вкус' },
      { key: 'citra',      name: 'Citra',      amountG: 30, timing: 'aroma',     role: '🌸 тропики' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'hoppy', waterName: 'Хмелевая (сульфатная)',
    mashTempC: 65, fermentTempC: 19,
    notes: 'Интенсивная горечь, яркий хмелевой аромат (цитрус, тропики).',
  },
  hefeweizen: {
    malts: [
      { key: 'wheat',    name: 'Wheat Malt', amountKg: 2.5, role: 'основа (50%+)' },
      { key: 'pilsner',  name: 'Pilsner',    amountKg: 2.0, role: 'основа' },
    ],
    hops: [
      { key: 'hallertau', name: 'Hallertau', amountG: 15, timing: 'bittering', role: '⚡ горечь' },
    ],
    yeastKey: 'wb06', yeastName: 'WB-06 Weizen',
    waterKey: 'soft', waterName: 'Мягкая',
    mashTempC: 67, fermentTempC: 20,
    notes: 'Дрожжи WB-06 дают характерные нотки банана и гвоздики.',
  },
  stout: {
    malts: [
      { key: 'pale_2row',  name: 'Pale Ale (2-row)', amountKg: 3.2, role: 'основа' },
      { key: 'roasted',    name: 'Roasted Barley',   amountKg: 0.5, role: 'жжёный вкус, цвет' },
      { key: 'crystal80',  name: 'Crystal 80',        amountKg: 0.3, role: 'карамель, тело' },
    ],
    hops: [
      { key: 'magnum', name: 'Magnum', amountG: 22, timing: 'bittering', role: '⚡ горечь' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'carbonate', waterName: 'Карбонатная (Дублин)',
    mashTempC: 66, fermentTempC: 19,
    notes: 'Roasted Barley даёт кофейный/шоколадный вкус и угольно-чёрный цвет.',
  },
  dry_stout: {
    malts: [
      { key: 'pale_2row', name: 'Pale Ale (2-row)', amountKg: 3.2, role: 'основа' },
      { key: 'roasted',   name: 'Roasted Barley',   amountKg: 0.5, role: 'жжёный, кофе' },
      { key: 'crystal80', name: 'Crystal 80',        amountKg: 0.3, role: 'карамель' },
    ],
    hops: [
      { key: 'magnum', name: 'Magnum', amountG: 22, timing: 'bittering', role: '⚡ горечь' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'carbonate', waterName: 'Карбонатная (Дублин)',
    mashTempC: 66, fermentTempC: 19,
    notes: 'Сухое послевкусие, минимальная сладость. Снизь OG до нижней границы.',
  },
  porter: {
    malts: [
      { key: 'pale_2row',  name: 'Pale Ale (2-row)', amountKg: 4.0, role: 'основа' },
      { key: 'chocolate',  name: 'Chocolate Malt',   amountKg: 0.4, role: 'шоколад, цвет' },
      { key: 'crystal40',  name: 'Caramel/Crystal 40', amountKg: 0.4, role: 'карамель, тело' },
    ],
    hops: [
      { key: 'magnum',  name: 'Magnum',  amountG: 20, timing: 'bittering', role: '⚡ горечь' },
      { key: 'cascade', name: 'Cascade', amountG: 15, timing: 'flavor',    role: '🌿 вкус' },
    ],
    yeastKey: 'notty', yeastName: 'Nottingham Ale',
    waterKey: 'malty', waterName: 'Солодовая (хлоридная)',
    mashTempC: 67, fermentTempC: 19,
    notes: 'Тёмный солод даёт шоколадно-кофейные нотки. Солодовая вода смягчает горечь.',
  },
  pilsner: {
    malts: [
      { key: 'pilsner', name: 'Pilsner', amountKg: 4.3, role: 'основа (100%)' },
    ],
    hops: [
      { key: 'saaz', name: 'Saaz', amountG: 20, timing: 'bittering', role: '⚡ горечь' },
      { key: 'saaz', name: 'Saaz', amountG: 15, timing: 'flavor',    role: '🌿 пряный' },
    ],
    yeastKey: 's23', yeastName: 'S-23 Lager',
    waterKey: 'soft', waterName: 'Мягкая',
    mashTempC: 65, fermentTempC: 10,
    notes: 'Требует S-23 (лагерные дрожжи). Брожение при 10°C — холодно и долго. Чистый, зерновой вкус.',
  },
  neipa: {
    malts: [
      { key: 'pale_2row',   name: 'Pale Ale (2-row)', amountKg: 4.0, role: 'основа' },
      { key: 'flaked_oats', name: 'Flaked Oats',       amountKg: 0.8, role: 'мутность, тело' },
      { key: 'wheat',       name: 'Wheat Malt',        amountKg: 0.5, role: 'мутность, пена' },
    ],
    hops: [
      { key: 'citra',  name: 'Citra',  amountG: 15, timing: 'bittering', role: '⚡ горечь' },
      { key: 'mosaic', name: 'Mosaic', amountG: 40, timing: 'aroma',     role: '🌸 тропики' },
      { key: 'simcoe', name: 'Simcoe', amountG: 40, timing: 'dry_hop',   role: '🧊 сухое охмеление' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'malty', waterName: 'Солодовая (хлоридная)',
    mashTempC: 67, fermentTempC: 20,
    notes: 'Мутная, тропическая, мягкая. Сухое охмеление — ключ к аромату. Ovats/пшеница дают тело.',
  },
  saison: {
    malts: [
      { key: 'pilsner', name: 'Pilsner', amountKg: 4.2, role: 'основа' },
    ],
    hops: [
      { key: 'saaz',    name: 'Saaz',    amountG: 20, timing: 'bittering', role: '⚡ горечь' },
      { key: 'hallertau',name:'Hallertau',amountG: 15, timing: 'flavor',   role: '🌿 пряный' },
    ],
    yeastKey: 'notty', yeastName: 'Nottingham Ale',
    waterKey: 'balanced', waterName: 'Сбалансированная',
    mashTempC: 64, fermentTempC: 22,
    notes: 'Высокая температура брожения (22°C+) даёт фруктово-пряный характер.',
  },
  brown: {
    malts: [
      { key: 'pale_2row',  name: 'Pale Ale (2-row)', amountKg: 3.8, role: 'основа' },
      { key: 'crystal80',  name: 'Crystal 80',        amountKg: 0.5, role: 'карамель, изюм' },
      { key: 'chocolate',  name: 'Chocolate Malt',    amountKg: 0.2, role: 'цвет, шоколад' },
    ],
    hops: [
      { key: 'centennial', name: 'Centennial', amountG: 20, timing: 'bittering', role: '⚡ горечь' },
      { key: 'cascade',    name: 'Cascade',    amountG: 15, timing: 'flavor',    role: '🌿 аромат' },
    ],
    yeastKey: 'notty', yeastName: 'Nottingham Ale',
    waterKey: 'balanced', waterName: 'Сбалансированная',
    mashTempC: 67, fermentTempC: 19,
    notes: 'Карамельная сладость, орех, лёгкий шоколад. Умеренная горечь.',
  },
  witbier: {
    malts: [
      { key: 'pilsner', name: 'Pilsner',    amountKg: 2.3, role: 'основа' },
      { key: 'wheat',   name: 'Wheat Malt', amountKg: 2.0, role: 'основа (40%+)' },
    ],
    hops: [
      { key: 'hallertau', name: 'Hallertau', amountG: 14, timing: 'bittering', role: '⚡ горечь' },
    ],
    yeastKey: 'wb06', yeastName: 'WB-06 Weizen',
    waterKey: 'soft', waterName: 'Мягкая',
    mashTempC: 66, fermentTempC: 21,
    notes: 'Традиционно добавляют кориандр и апельсиновую цедру (добавки). Лёгкое, освежающее.',
  },
  marzen: {
    malts: [
      { key: 'pilsner', name: 'Pilsner', amountKg: 2.5, role: 'основа' },
      { key: 'munich',  name: 'Munich',  amountKg: 2.0, role: 'хлебный, солодовый' },
    ],
    hops: [
      { key: 'hallertau', name: 'Hallertau', amountG: 20, timing: 'bittering', role: '⚡ горечь' },
      { key: 'saaz',      name: 'Saaz',      amountG: 15, timing: 'flavor',    role: '🌿 пряный' },
    ],
    yeastKey: 's23', yeastName: 'S-23 Lager',
    waterKey: 'balanced', waterName: 'Сбалансированная',
    mashTempC: 67, fermentTempC: 10,
    notes: 'Октябрьское пиво. Munich даёт насыщенный солодовый хлебный вкус.',
  },
  american_ipa: {
    malts: [
      { key: 'pale_2row', name: 'Pale Ale (2-row)',   amountKg: 4.5, role: 'основа' },
      { key: 'crystal40', name: 'Caramel/Crystal 40', amountKg: 0.4, role: 'тело, карамель' },
      { key: 'munich',    name: 'Munich',              amountKg: 0.3, role: 'солодовость' },
    ],
    hops: [
      { key: 'magnum',     name: 'Magnum',     amountG: 30, timing: 'bittering', role: '⚡ горечь' },
      { key: 'centennial', name: 'Centennial', amountG: 25, timing: 'flavor',    role: '🌿 цветочный' },
      { key: 'citra',      name: 'Citra',      amountG: 30, timing: 'aroma',     role: '🌸 тропики' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'hoppy', waterName: 'Хмелевая (сульфатная)',
    mashTempC: 66, fermentTempC: 19,
    notes: 'Классический американский IPA: яркая горечь, тропический аромат хмеля.',
  },
  german_pils: {
    malts: [
      { key: 'pilsner', name: 'Pilsner', amountKg: 4.3, role: 'основа (100%)' },
    ],
    hops: [
      { key: 'saaz',     name: 'Saaz',     amountG: 20, timing: 'bittering', role: '⚡ горечь' },
      { key: 'saaz',     name: 'Saaz',     amountG: 15, timing: 'flavor',    role: '🌿 пряный' },
      { key: 'tettnang', name: 'Tettnang', amountG: 15, timing: 'aroma',     role: '🌸 аромат' },
    ],
    yeastKey: 'german_lager', yeastName: 'German Lager (34/70)',
    waterKey: 'soft', waterName: 'Мягкая',
    mashTempC: 65, fermentTempC: 10,
    notes: 'Немецкий пилснер: сухое тело, пряный хмель Saaz, холодное брожение.',
  },
  brown_ale: {
    malts: [
      { key: 'pale_2row', name: 'Pale Ale (2-row)', amountKg: 3.5, role: 'основа' },
      { key: 'munich',    name: 'Munich',            amountKg: 0.6, role: 'хлебный' },
      { key: 'crystal60', name: 'Crystal 60',        amountKg: 0.4, role: 'карамель, цвет' },
    ],
    hops: [
      { key: 'ekg',    name: 'East Kent Goldings', amountG: 25, timing: 'bittering', role: '⚡ горечь' },
      { key: 'fuggle', name: 'Fuggle',              amountG: 15, timing: 'flavor',    role: '🌿 земляной' },
    ],
    yeastKey: 'english_ale', yeastName: 'English Ale',
    waterKey: 'balanced', waterName: 'Сбалансированная',
    mashTempC: 67, fermentTempC: 20,
    notes: 'Британский браун: солодовый, орехово-карамельный, мягкая горечь.',
  },
  american_porter: {
    malts: [
      { key: 'pale_2row', name: 'Pale Ale (2-row)', amountKg: 4.2, role: 'основа' },
      { key: 'munich',    name: 'Munich',            amountKg: 0.5, role: 'солодовость' },
      { key: 'crystal60', name: 'Crystal 60',        amountKg: 0.4, role: 'карамель' },
      { key: 'chocolate', name: 'Chocolate Malt',    amountKg: 0.4, role: 'шоколад, цвет' },
    ],
    hops: [
      { key: 'magnum',  name: 'Magnum',  amountG: 22, timing: 'bittering', role: '⚡ горечь' },
      { key: 'cascade', name: 'Cascade', amountG: 20, timing: 'flavor',    role: '🌿 аромат' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'malty', waterName: 'Солодовая (хлоридная)',
    mashTempC: 67, fermentTempC: 19,
    notes: 'Американский портер: шоколадно-кофейные нотки, хмелевой акцент.',
  },
  hazy_ipa: {
    malts: [
      { key: 'pale_2row',   name: 'Pale Ale (2-row)', amountKg: 4.5, role: 'основа' },
      { key: 'flaked_oats', name: 'Flaked Oats',      amountKg: 0.8, role: 'кремовое тело' },
      { key: 'wheat',       name: 'Wheat Malt',       amountKg: 0.5, role: 'мутность' },
    ],
    hops: [
      { key: 'magnum', name: 'Magnum', amountG: 10, timing: 'bittering', role: '⚡ горечь' },
      { key: 'citra',  name: 'Citra',  amountG: 40, timing: 'aroma',     role: '🌸 тропики' },
      { key: 'mosaic', name: 'Mosaic', amountG: 40, timing: 'aroma',     role: '🍓 ягоды' },
      { key: 'simcoe', name: 'Simcoe', amountG: 30, timing: 'aroma',     role: '🌲 сосна' },
    ],
    yeastKey: 'us05', yeastName: 'US-05 American Ale',
    waterKey: 'malty', waterName: 'Солодовая (хлоридная)',
    mashTempC: 67, fermentTempC: 20,
    notes: 'Хейзи IPA: мутное, тропически-ягодное, мягкое. Много сухого хмелевания.',
  },
  tripel: {
    malts: [
      { key: 'pilsner', name: 'Pilsner', amountKg: 5.5, role: 'основа' },
    ],
    hops: [
      { key: 'saaz',     name: 'Saaz',     amountG: 25, timing: 'bittering', role: '⚡ горечь' },
      { key: 'tettnang', name: 'Tettnang', amountG: 15, timing: 'flavor',    role: '🌿 пряный' },
    ],
    yeastKey: 'belgian_abbey', yeastName: 'Belgian Abbey/Tripel',
    waterKey: 'soft', waterName: 'Мягкая',
    mashTempC: 65, fermentTempC: 22,
    notes: 'Бельгийский трипель: крепкое, сухое, пряно-фруктовое, золотисто-прозрачное.',
  },
}

// Стили
export const BEER_STYLES: StyleData[] = [
  { key: 'pale_ale',   name: 'American Pale Ale',  family: 'Эль (хмелевой)',  og: [1.045, 1.060], fg: [1.010, 1.015], abv: [4.5, 6.2], ibu: [30, 50],  srm: [5, 10],   bugu_target: [0.6, 0.9], base_price: 95,  difficulty: 1, unlock_level: 1 },
  { key: 'ipa',        name: 'American IPA',        family: 'Эль (хмелевой)',  og: [1.056, 1.075], fg: [1.008, 1.014], abv: [5.5, 7.5], ibu: [40, 70],  srm: [6, 14],   bugu_target: [0.8, 1.2], base_price: 115, difficulty: 2, unlock_level: 2 },
  { key: 'hefeweizen', name: 'Hefeweizen',          family: 'Пшеничный',       og: [1.044, 1.052], fg: [1.010, 1.014], abv: [4.3, 5.6], ibu: [10, 20],  srm: [3, 9],    bugu_target: [0.2, 0.5], base_price: 90,  difficulty: 1, unlock_level: 1 },
  { key: 'stout',      name: 'Dry Irish Stout',     family: 'Тёмный',          og: [1.036, 1.050], fg: [1.007, 1.011], abv: [3.8, 5.0], ibu: [30, 45],  srm: [25, 40],  bugu_target: [0.7, 1.1], base_price: 100, difficulty: 2, unlock_level: 2 },
  { key: 'porter',     name: 'Robust Porter',       family: 'Тёмный',          og: [1.050, 1.065], fg: [1.012, 1.016], abv: [4.8, 6.5], ibu: [25, 40],  srm: [20, 30],  bugu_target: [0.5, 0.9], base_price: 105, difficulty: 2, unlock_level: 2 },
  { key: 'pilsner',    name: 'Czech Pilsner',       family: 'Лагер',           og: [1.044, 1.056], fg: [1.013, 1.017], abv: [4.1, 5.1], ibu: [30, 45],  srm: [3, 6],    bugu_target: [0.6, 0.9], base_price: 88,  difficulty: 3, unlock_level: 3 },
  { key: 'neipa',      name: 'New England IPA',     family: 'Эль (хмелевой)',  og: [1.060, 1.075], fg: [1.010, 1.015], abv: [6.0, 7.5], ibu: [25, 50],  srm: [3, 7],    bugu_target: [0.4, 0.8], base_price: 130, difficulty: 3, unlock_level: 3 },
  { key: 'saison',     name: 'Saison',              family: 'Эль (бельгийский)',og: [1.048, 1.065],fg: [1.008, 1.014], abv: [4.5, 7.0], ibu: [20, 35],  srm: [5, 14],   bugu_target: [0.4, 0.7], base_price: 110, difficulty: 3, unlock_level: 3 },
  { key: 'brown',      name: 'American Brown Ale',  family: 'Эль (тёмный)',    og: [1.045, 1.060], fg: [1.010, 1.016], abv: [4.3, 6.2], ibu: [20, 30],  srm: [18, 35],  bugu_target: [0.4, 0.7], base_price: 98,  difficulty: 2, unlock_level: 2 },
  { key: 'witbier',    name: 'Witbier',             family: 'Пшеничный',       og: [1.044, 1.052], fg: [1.008, 1.012], abv: [4.5, 5.5], ibu: [10, 20],  srm: [2, 4],    bugu_target: [0.2, 0.5], base_price: 92,  difficulty: 2, unlock_level: 2 },
  { key: 'marzen',          name: 'Märzen / Oktoberfest', family: 'Лагер',                    og: [1.054, 1.060], fg: [1.010, 1.014], abv: [5.8, 6.3], ibu: [18, 24],  srm: [8, 17],   bugu_target: [0.3, 0.5], base_price: 102, difficulty: 3, unlock_level: 3 },
  { key: 'dry_stout',       name: 'Dry Stout',            family: 'Тёмный',                   og: [1.036, 1.050], fg: [1.007, 1.011], abv: [3.8, 5.0], ibu: [30, 45],  srm: [25, 40],  bugu_target: [0.7, 1.1], base_price: 100, difficulty: 2, unlock_level: 2 },
  { key: 'american_ipa',    name: 'American IPA',         family: 'Эль (хмелевой)',           og: [1.056, 1.070], fg: [1.008, 1.014], abv: [5.5, 7.5], ibu: [40, 70],  srm: [6, 14],   bugu_target: [0.7, 1.1], base_price: 110, difficulty: 2, unlock_level: 4 },
  { key: 'german_pils',     name: 'German Pils',          family: 'Лагер',                    og: [1.044, 1.050], fg: [1.008, 1.013], abv: [4.4, 5.2], ibu: [22, 40],  srm: [2, 5],    bugu_target: [0.55, 0.9],base_price: 90,  difficulty: 3, unlock_level: 3 },
  { key: 'brown_ale',       name: 'British Brown Ale',    family: 'Эль (солодовый)',          og: [1.040, 1.052], fg: [1.008, 1.013], abv: [4.2, 5.4], ibu: [20, 30],  srm: [12, 22],  bugu_target: [0.45, 0.65],base_price: 90, difficulty: 2, unlock_level: 5 },
  { key: 'american_porter', name: 'American Porter',      family: 'Эль (тёмный)',             og: [1.048, 1.065], fg: [1.012, 1.016], abv: [4.8, 6.5], ibu: [25, 50],  srm: [22, 40],  bugu_target: [0.5, 0.8], base_price: 105, difficulty: 3, unlock_level: 6 },
  { key: 'hazy_ipa',        name: 'Hazy IPA (NEIPA)',     family: 'Эль (хмелевой)',           og: [1.060, 1.075], fg: [1.010, 1.015], abv: [6.0, 7.5], ibu: [25, 60],  srm: [4, 7],    bugu_target: [0.5, 0.9], base_price: 135, difficulty: 5, unlock_level: 11 },
  { key: 'tripel',          name: 'Belgian Tripel',       family: 'Бельгийское (крепкое)',    og: [1.075, 1.085], fg: [1.008, 1.014], abv: [7.5, 9.5], ibu: [20, 40],  srm: [4.5, 7],  bugu_target: [0.3, 0.5], base_price: 150, difficulty: 5, unlock_level: 12 },
]
