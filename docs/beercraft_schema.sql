-- =====================================================================
-- BeerCraft — PostgreSQL schema (DDL)
-- Версия 1.0 · соответствует ТЗ §10 и Приложениям A–D
-- Соглашения: snake_case; первичные ключи bigint identity (кроме
-- справочников ingredients/beer_styles — natural key + surrogate id);
-- гибкие структуры (профили, рецепт, процесс) — jsonb;
-- временные метки — timestamptz; денежные/счётные — integer/numeric.
-- Логика и расчёты выполняются на сервере; БД хранит состояние.
-- =====================================================================

-- ---------- ENUM-типы ----------
CREATE TYPE currency_kind   AS ENUM ('soft', 'premium', 'reputation');
CREATE TYPE ingredient_type AS ENUM ('malt', 'hop', 'yeast', 'water', 'adjunct');
CREATE TYPE batch_status    AS ENUM ('mashing', 'boiling', 'fermenting', 'conditioning', 'ready', 'sold', 'discarded');
CREATE TYPE order_status     AS ENUM ('open', 'fulfilled', 'expired', 'cancelled');
CREATE TYPE match_mode       AS ENUM ('duel', 'festival', 'coop');
CREATE TYPE match_status     AS ENUM ('lobby', 'in_progress', 'finished', 'cancelled');
CREATE TYPE participant_result AS ENUM ('pending', 'win', 'loss', 'draw');
CREATE TYPE brewery_role     AS ENUM ('owner', 'brewer', 'buyer', 'seller', 'member');
CREATE TYPE txn_type         AS ENUM ('sale', 'order_reward', 'purchase_ingredient', 'purchase_equipment',
                                      'match_reward', 'season_reward', 'refund', 'adjustment');
CREATE TYPE store_kind       AS ENUM ('ingredient', 'equipment', 'cosmetic', 'fermenter_slot', 'pass');

-- ---------- Пользователи ----------
CREATE TABLE users (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_id     bigint NOT NULL UNIQUE,            -- из валидированного initData
    username        text,
    display_name    text,
    level           integer NOT NULL DEFAULT 1,
    xp              integer NOT NULL DEFAULT 0,
    soft_currency   integer NOT NULL DEFAULT 0,
    premium_currency integer NOT NULL DEFAULT 0,        -- заложена, на старте не пополняется
    reputation      integer NOT NULL DEFAULT 0,
    locale          text NOT NULL DEFAULT 'ru',
    age_confirmed   boolean NOT NULL DEFAULT false,     -- 18+ gate
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz
);

-- ---------- Пивоварни (1 у игрока; совладельцы — для кооп, Этап Б) ----------
CREATE TABLE breweries (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        text NOT NULL DEFAULT 'Моя пивоварня',
    treasury    integer NOT NULL DEFAULT 0,             -- общая казна (актуально для кооп)
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brewery_members (
    brewery_id  bigint NOT NULL REFERENCES breweries(id) ON DELETE CASCADE,
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        brewery_role NOT NULL DEFAULT 'member',
    joined_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (brewery_id, user_id)
);

-- ---------- Оборудование ----------
CREATE TABLE equipment (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brewery_id  bigint NOT NULL REFERENCES breweries(id) ON DELETE CASCADE,
    type        text NOT NULL,                          -- 'kettle','temp_controller','fermenter','glycol','filtration','cold_storage','qa_lab'
    level       integer NOT NULL DEFAULT 1,             -- ступень апгрейда / объём
    params      jsonb NOT NULL DEFAULT '{}'::jsonb,     -- напр. {"volume_l":40,"green_zone_bonus":0.1}
    acquired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipment_brewery ON equipment(brewery_id);

-- ---------- Справочник ингредиентов (seed: beercraft_content.json) ----------
CREATE TABLE ingredients (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key         text NOT NULL UNIQUE,                   -- 'pale_2row','citra','us05','soft','coriander'
    type        ingredient_type NOT NULL,
    name        text NOT NULL,
    -- параметры зависят от типа: malt{ppkg,color_l}; hop{alpha,role}; yeast{attenuation,temp_min,temp_max};
    -- water{lean}; adjunct{effect}; общий тег профиля во flavor:
    params      jsonb NOT NULL DEFAULT '{}'::jsonb,
    base_price  integer NOT NULL DEFAULT 0,             -- за единицу (кг / 100 г / внесение)
    unit        text NOT NULL DEFAULT 'kg',             -- 'kg','100g','pitch'
    unlock_level integer NOT NULL DEFAULT 1
);
CREATE INDEX idx_ingredients_type ON ingredients(type);

-- ---------- Инвентарь (склад ингредиентов пивоварни) ----------
CREATE TABLE inventory (
    brewery_id    bigint NOT NULL REFERENCES breweries(id) ON DELETE CASCADE,
    ingredient_id bigint NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity      numeric(10,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (brewery_id, ingredient_id)
);

-- ---------- Стили (реальные + авторские) ----------
CREATE TABLE beer_styles (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key          text UNIQUE,                           -- для каталожных; NULL у авторских
    name         text NOT NULL,
    family       text,
    og_min numeric(5,3), og_max numeric(5,3),
    fg_min numeric(5,3), fg_max numeric(5,3),
    abv_min numeric(4,2), abv_max numeric(4,2),
    ibu_min integer, ibu_max integer,
    srm_min numeric(4,1), srm_max numeric(4,1),
    bugu_min numeric(4,2), bugu_max numeric(4,2),       -- целевой баланс BU:GU
    profile      jsonb NOT NULL DEFAULT '{}'::jsonb,    -- целевые теги вкуса
    base_price   integer NOT NULL DEFAULT 90,
    difficulty   smallint NOT NULL DEFAULT 1,
    unlock_level integer NOT NULL DEFAULT 1,
    description  text,
    is_custom    boolean NOT NULL DEFAULT false,
    author_id    bigint REFERENCES users(id) ON DELETE SET NULL,
    is_public    boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_styles_public_custom ON beer_styles(is_custom, is_public);

-- ---------- Рецепты ----------
CREATE TABLE recipes (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    target_style_id bigint REFERENCES beer_styles(id) ON DELETE SET NULL,  -- NULL = свободный стиль
    version         integer NOT NULL DEFAULT 1,
    malt_bill       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{"key":"pale_2row","kg":4.5}, ...]
    hop_schedule    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{"key":"citra","g":30,"timing":"aroma","minute":5}, ...]
    yeast_key       text,                                -- ключ дрожжей
    water_key       text,                                -- ключ профиля воды
    adjuncts        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{"key":"coriander","g":20}, ...]
    process         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"mash_temp_c":66,"boil_min":60,"ferment_temp_c":19}
    notes           text,
    is_public       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (author_id, name, version)
);
CREATE INDEX idx_recipes_author ON recipes(author_id);

-- ---------- Партии (результат варки) ----------
CREATE TABLE batches (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brewery_id   bigint NOT NULL REFERENCES breweries(id) ON DELETE CASCADE,
    recipe_id    bigint REFERENCES recipes(id) ON DELETE SET NULL,
    style_id     bigint REFERENCES beer_styles(id) ON DELETE SET NULL,
    volume_l     numeric(6,1) NOT NULL,
    status       batch_status NOT NULL DEFAULT 'mashing',
    started_at   timestamptz NOT NULL DEFAULT now(),
    ready_at     timestamptz,                            -- метка готовности (фоновые таймеры)
    -- итоговые параметры (B.1–B.6):
    og numeric(5,3), fg numeric(5,3), abv numeric(4,2), ibu integer, srm numeric(4,1),
    profile      jsonb NOT NULL DEFAULT '{}'::jsonb,     -- вектор вкуса
    accuracy     jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {"mash":0.9,"hops":0.85,"chill":0.95,"ferment":0.9}
    style_match  integer,                                -- 0–100 (B.8)
    quality      integer,                                -- 0–100 (B.10)
    match_id     bigint,                                 -- если сварено в соревновании (FK ниже)
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_brewery_status ON batches(brewery_id, status);

-- ---------- Заказы рынка ----------
CREATE TABLE market_orders (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brewery_id      bigint REFERENCES breweries(id) ON DELETE CASCADE,  -- NULL = глобальный заказ
    customer_name   text NOT NULL,
    required_style_key text,                             -- требуемый стиль (ключ)
    constraints     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"ibu":[40,70],"abv":[5.5,7.5],"min_quality":80}
    reward_soft     integer NOT NULL DEFAULT 0,
    reward_reputation integer NOT NULL DEFAULT 0,
    deadline_at     timestamptz,
    status          order_status NOT NULL DEFAULT 'open',
    fulfilled_batch_id bigint REFERENCES batches(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_brewery_status ON market_orders(brewery_id, status);

-- ---------- Мультиплеер: матчи ----------
CREATE TABLE matches (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mode        match_mode NOT NULL,
    seed        bigint NOT NULL,                         -- детерминизм мини-игры/заданий
    task        jsonb NOT NULL DEFAULT '{}'::jsonb,      -- {"style":"pilsner","budget":500,"time_sec":300}
    status      match_status NOT NULL DEFAULT 'lobby',
    winner_id   bigint REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
);

CREATE TABLE match_participants (
    match_id    bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id    bigint REFERENCES batches(id) ON DELETE SET NULL,
    score       integer,
    result      participant_result NOT NULL DEFAULT 'pending',
    is_ready    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (match_id, user_id)
);

-- отложенная связь batches.match_id -> matches.id
ALTER TABLE batches
    ADD CONSTRAINT fk_batches_match FOREIGN KEY (match_id)
    REFERENCES matches(id) ON DELETE SET NULL;

-- ---------- Рейтинг / сезоны ----------
CREATE TABLE rating_seasons (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name      text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at   timestamptz NOT NULL
);

CREATE TABLE ratings (
    season_id bigint NOT NULL REFERENCES rating_seasons(id) ON DELETE CASCADE,
    user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating    integer NOT NULL DEFAULT 1000,             -- эло-подобный
    wins      integer NOT NULL DEFAULT 0,
    losses    integer NOT NULL DEFAULT 0,
    PRIMARY KEY (season_id, user_id)
);

-- ---------- Транзакции (экономика/аналитика) ----------
CREATE TABLE transactions (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       txn_type NOT NULL,
    currency   currency_kind NOT NULL,
    amount     integer NOT NULL,                         -- может быть отрицательным (расход)
    reason     text,
    ref_id     bigint,                                   -- batch/order/match id и т.п.
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_user_time ON transactions(user_id, created_at);

-- ---------- Каталог магазина (монетизация заложена, управляется флагами) ----------
CREATE TABLE store_catalog (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind          store_kind NOT NULL,
    ref_key       text NOT NULL,                         -- ключ ингредиента/оборуд./косметики
    title         text NOT NULL,
    price_currency currency_kind NOT NULL DEFAULT 'soft',
    price_amount  integer NOT NULL,
    enabled       boolean NOT NULL DEFAULT true,
    feature_flag  text,                                  -- напр. 'monetization' (off на старте)
    unlock_level  integer NOT NULL DEFAULT 1
);

-- ---------- Достижения (опционально) ----------
CREATE TABLE achievements (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key   text NOT NULL UNIQUE,
    title text NOT NULL,
    description text
);
CREATE TABLE user_achievements (
    user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id bigint NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);

-- =====================================================================
-- Примечания по реализации:
--  * Длительные процессы (брожение/выдержка) считаются по started_at/ready_at,
--    без воркера-на-игрока; уведомления планируются отдельно.
--  * Идемпотентность операций варки/продажи обеспечивается на сервисном слое
--    (напр. уникальный operation_id), здесь не показано.
--  * jsonb-поля валидируются схемой на сервере; при необходимости —
--    добавить CHECK/наложить json-schema на уровне приложения.
-- =====================================================================
