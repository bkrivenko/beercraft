# BeerCraft — контекст для Claude Code

## Что это
Telegram Mini App — игра-пивоварня. Стек: React/Vite фронт, Fastify/Prisma бэкенд, PostgreSQL, Redis, gramm

## Ключевые правила
- Вся игровая логика — только на сервере (src/game/), никаких расчётов на клиенте.
- Prisma schema в prisma/schema.prisma (соответствует beercraft_schema.sql).
- Все игровые коэффициенты — в src/config/game-config.ts (не хардкодить в логике).
- Frontend: компоненты в src/components/, экраны в src/screens/, Telegram в src/telegram/.
- API: REST /api/v1/ для состояния, WebSocket /ws для realtime (лобби/дуэль).
- Telegram initData валидируется middleware src/middleware/auth.ts на каждый запрос.

## Документация
ТЗ: docs/TZ_BeerCraft_Telegram.md
Формулы: docs/Formuly_Balansa_BeerCraft.md
Экраны: docs/Spec_Ekrany_BeerCraft.md
