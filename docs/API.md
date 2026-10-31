# AlphaTape API

Base URL: `http://localhost:3848`

Every market field is `{ value, source, asOf, note }`. `value: null` means the figure was not supplied. The server does not invent a number. AI scores include `modelEstimate: true`.

## Health and metrics

```bash
curl -s http://localhost:3848/health
curl -s http://localhost:3848/metrics
```

`/health` checks Postgres and Redis. `/metrics` is Prometheus text.

## Meta

```bash
curl -s http://localhost:3848/api/v1/meta
```

Returns demo mode, the bilingual disclaimer, and every provider with `configured`, the reason it is off, and TASE support.

## Stocks

```bash
curl -s 'http://localhost:3848/api/v1/stocks?strongBuy=true&minUpside=30&limit=10'
curl -s http://localhost:3848/api/v1/stocks/NVDA
curl -s http://localhost:3848/api/v1/stocks/NVDA/bars
curl -s http://localhost:3848/api/v1/stocks/TEVA.TA/news
curl -s http://localhost:3848/api/v1/dividends
curl -s 'http://localhost:3848/api/v1/heatmap'
curl -s 'http://localhost:3848/api/v1/movers'
curl -s 'http://localhost:3848/api/v1/compare?symbols=NVDA,AMD,CRWD'
```

Query filters on `/api/v1/stocks`: `q`, `strongBuy`, `breakout`, `minUpside`, `maxUpside`, `minMarketCap`, `maxMarketCap`, `minPrice`, `maxPrice`, `rsiMin`, `rsiMax`, `minAnalysts`, `minConfidence`, `sector`, `theme`, `limit`.

## Auth

Demo user: `adi@demo.local` / `DemoPass123!`

```bash
curl -s -c /tmp/alphatape.cookies -H 'content-type: application/json' \
  -d '{"email":"adi@demo.local","password":"DemoPass123!"}' \
  http://localhost:3848/api/v1/auth/login

curl -s -b /tmp/alphatape.cookies http://localhost:3848/api/v1/auth/me
```

Register:

```bash
curl -s -H 'content-type: application/json' \
  -d '{"email":"new@example.com","password":"long-password","name":"New"}' \
  http://localhost:3848/api/v1/auth/register
```

The login response includes a bearer token. Send `Authorization: Bearer <token>` or use the `alphatape_token` cookie.

## Watchlist, alerts, weights

```bash
curl -s -b /tmp/alphatape.cookies -H 'content-type: application/json' \
  -d '{"symbol":"NVDA"}' http://localhost:3848/api/v1/watchlist

curl -s -b /tmp/alphatape.cookies -X DELETE http://localhost:3848/api/v1/watchlist/NVDA

curl -s -b /tmp/alphatape.cookies -H 'content-type: application/json' \
  -d '{"symbol":"NVDA","kind":"price_above","threshold":150}' \
  http://localhost:3848/api/v1/alerts

curl -s -b /tmp/alphatape.cookies http://localhost:3848/api/v1/notifications

curl -s -b /tmp/alphatape.cookies -X PUT -H 'content-type: application/json' \
  -d '{"consensus":0.2,"upside":0.2}' http://localhost:3848/api/v1/settings
```

Alert kinds: `price_above`, `price_below`, `score_above`, `score_below`, `change_pct_above`.

## AI note

Returns `{ enabled: false }` when `OPENAI_API_KEY` is unset. No substitute paragraph is generated.

```bash
curl -s -H 'content-type: application/json' \
  -d '{"locale":"he"}' http://localhost:3848/api/v1/stocks/NVDA/ai
```

## WebSocket

`ws://localhost:3848/ws`

Messages:

- `{ "type": "hello" }`
- `{ "type": "quotes", "demo": true, "source": "demo-simulator", "items": [{ "symbol", "price", "change", "changePercent", "volume", "asOf", "source" }] }`
- `{ "type": "alert", "userId", "notification" }` only to the matching signed-in socket

The browser sends the auth cookie on the handshake. A non-browser client can send `{ "type": "auth", "token": "<jwt>" }`.
