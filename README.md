# Pokédex for people

A real-life dex for a room. You scan someone's LinkedIn, X, or Luma QR (there are no paper badges tonight), Grok Bot researches them, and a human approves the follow-up. Seen means scanned. Caught means the follow-up was approved.

The hub is one FastAPI app: the dex UI, the phone `/scan` page, the REST API, and an MCP server. It runs locally with `--mock` and deploys to Vercel as-is. A Raspberry Pi is a thin client (`HUB_URL`) that drives a Game Boy link cable and, if a camera exists, takes the photo.

We only scan people who agree. The photo is dithered into a 160×144 four-green sprite. Nothing in this repo does face recognition.

## 60-second quickstart

```bash
pip install -r requirements.txt
python3 -m pi_server --mock
```

Open [http://127.0.0.1:8741](http://127.0.0.1:8741). The dex already has three people. Arrow keys move, **Z** opens an entry, **Z** again opens the follow-up, **Z** approves it. **X** goes back, and on the draft **X** skips. A gamepad uses the same buttons (A approve path, B back/skip).

Seen and caught counts are on the list. `*` on a row means caught.

## Phone scan (default when there is no Pi camera)

`capture="environment"` opens the phone camera without HTTPS, so a LAN IP is enough. On the same Wi-Fi as the Pi or laptop:

```text
http://<that-machine-ip>:8741/scan
```

On the public demo, open `https://<your-vercel-app>/scan`. Ask first, check the consent box, then:

1. Photograph the QR code on their phone (LinkedIn, X, Luma, or any URL).
2. Photograph them, if they agree. That frame becomes the sprite.
3. If the QR will not read, type a name and company.
4. Add them. They show up as **seen** with the next number (`#004`, `#005`, …).

The page decodes the QR in the browser (BarcodeDetector, then jsQR). The server also tries pyzbar, then OpenCV, when those libraries are installed. Capture priority on the Pi itself is picamera2, then a USB webcam, then this phone page.

A laptop with no camera can check consent and use **Sample · Luis Ortega** or **Samira Qureshi**, then **Demo research** on the dex. That stand-in calls the same profile and queue writes Grok Bot uses. It only knows the demo URLs.

## Deploy this on Vercel

Framework: **FastAPI**, Python **3.12**. There is no separate build step.

| Setting | Value |
| --- | --- |
| Root directory | the project root (the folder with `vercel.json`) |
| Framework preset | FastAPI, or Other if the picker has no FastAPI row |
| Entrypoint | `app/main.py` exporting `app`. Also set in `pyproject.toml` as `app.main:app` |
| Install | `requirements.txt` / the dependencies in `pyproject.toml` |
| Build command | empty |
| Output directory | empty |

`vercel.json` only raises the function duration to 30 seconds.

Environment variables, all optional:

| Variable | What it does |
| --- | --- |
| `KV_REST_API_URL` and `KV_REST_API_TOKEN` | Upstash / Vercel KV. Dex survives cold starts. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Same REST store, Upstash's own names. |
| `REDIS_URL` | TCP Redis (`redis://` or `rediss://`) if the REST vars are unset. |
| `BLOB_READ_WRITE_TOKEN` | Photos and sprites go to Vercel Blob. Without it they are inline data URLs. |
| `DEX_EVENT` | Area label. Default `Grok Bot Hackathon, Austin`. |
| `MCP_TOKEN` | If set, `POST /mcp` requires `Authorization: Bearer …`. The browser stays open. |
| `DECISION_WEBHOOK_URL` | POST the follow-up JSON when it is approved or rejected. |

With none of the storage vars set, the function keeps a seeded dex in memory so the page always renders. A new scan lives on that instance until it goes cold. Set Redis before the judging demo if scans must stick.

MCP endpoint: `https://<your-app>/mcp`

Phone page: `https://<your-app>/scan`

## Connect Grok Bot

In the custom MCP connector, use streamable HTTP and the hub URL above. No tunnel to the Pi. The bot should:

1. `scan_person` with `consent: true`, the QR `url`, any typed `name` / `company`, and an optional photo. `capture_badge` is the same tool.
2. Research the URL or the name. Do not try to recognize a face.
3. `attach_profile` with `id`, `name`, `category` (for example `the Founder Pokémon`), `types` (one or two tags such as `AI` or `Hardware`), `title`, `company`, `flavor_text`, and `email`.
4. `queue_for_approval` with `to`, `subject`, `body`, and `contact_id`.
5. `get_decision` (or `wait_for_decisions`) before treating the note as sent.

```bash
python3 examples/mcp_demo.py --url http://127.0.0.1:8741/mcp
```

That script is the same sequence, using a demo LinkedIn URL.

Initialize:

```bash
curl -s http://127.0.0.1:8741/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"demo","version":"0"}}}'
```

## REST, for a future phone app

The Game Boy and the browser are clients. A phone app can replace the Game Boy without a new backend. Resources:

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/contacts?q=&type=&sort=number\|name\|type&limit=&offset=` | Dex list, plus `seen` and `caught` |
| GET | `/api/contacts/{id}` | One entry |
| POST | `/api/contacts/{id}/profile` | `attach_profile` |
| POST | `/api/contacts/{id}/approve` | A, catch them |
| POST | `/api/contacts/{id}/skip` | B on the draft |
| POST | `/api/scans` | JSON or multipart. `consent` is required. |
| POST | `/api/items` | Queue a follow-up |
| GET | `/api/items/{id}` | Decision |
| GET | `/docs` | OpenAPI |

`sort` is `number` (scan order), `name`, or `type`. Numbers are `#001`, `#002`, in the order people are scanned.

## Pi client

The hub holds the dex. The Pi only needs the link cable and, if you have one, a camera.

```bash
pip install -r requirements.txt
# optional camera stack:
# sudo apt install python3-picamera2 libzbar0
# pip install -r requirements-camera.txt
export HUB_URL=https://<your-app>.vercel.app
python3 -m pi_server --bridge
```

One consented photo from the Pi camera or a USB webcam:

```bash
python3 -m pi_server --capture --hub "$HUB_URL" --consent \
  --name "Luis Ortega" --company "Northwind Ag"
```

`--capture` refuses to run without `--consent`. Order inside that command: picamera2, then OpenCV `VideoCapture`, then an error that points you at `/scan`.

`--mock` never opens GPIO and ignores `HUB_URL`. It is the laptop demo.

## Game Boy

`gameboy/approval.gb` is built and ready for a flash cart (EverDrive, GBxCart, FlashGBX). Rebuild with GBDK-2020:

```bash
# https://github.com/gbdk-2020/gbdk-2020/releases/tag/4.5.0
make -C gameboy GBDK=/opt/gbdk
```

The ROM shows the open entry (number, name, category, types, flavor, area). **A** opens the follow-up, **A** again approves, **B** skips, left/right move between people, up/down scroll. The Pi is the clock master. Byte layout, pins, and the level-shifter wiring are in [gameboy/PROTOCOL.md](gameboy/PROTOCOL.md).

Short version: Game Boy pin 2 (SO, 5 V) → shifter → Pi BCM 23. Pi BCM 24 → shifter → pin 3 (SI). Pi BCM 25 → shifter → pin 4 (clock). Pin 5 to Pi GND. Pin 1 is the shifter's 5 V reference only. Never tie 5 V to a Pi GPIO.

## Three-minute demo

We only scan people who agree. Say that before anyone lifts a phone.

1. **0:00** Open the dex. Seen 03, caught 01. Priya is already caught. Move to Jonah with the D-pad.
2. **0:30** **Z** opens Jonah, the Buyer Pokémon. **Z** again shows the draft. Read one sentence. **Z** approves. Caught becomes 02.
3. **1:10** On a phone, open `/scan`. Check consent. Either photograph a LinkedIn QR plus a portrait, or use the Luis sample if you are on a laptop.
4. **1:50** He appears as seen, `#004`, sprite on the entry. If Grok Bot is connected, it calls `attach_profile` and `queue_for_approval` from the URL. If not, press **Demo research**. That is the same write, limited to the demo profiles.
5. **2:30** Open the new draft and approve or skip it. Point at `/mcp` and, if the cart is flashed, at the DMG showing the same entry.

## Tests

```bash
python3 -m pytest -q
```

## Troubleshooting

- **The phone camera input does nothing.** Use Safari or Chrome. The control is `<input type="file" accept="image/*" capture="environment">`, which works on `http://` LAN addresses. If the browser still refuses, upload from the photo library.
- **QR reads blank.** Move closer, fill the frame with the code, or type the name and company. The entry can still be created.
- **Scans disappear on Vercel.** The instance is using memory. Set the Upstash REST vars.
- **Images are huge in the JSON.** Set `BLOB_READ_WRITE_TOKEN`. Until then sprites are data URLs, which is fine for a handful of people.
- **MCP client hangs.** POST one JSON-RPC object to `/mcp` with `Accept: application/json, text/event-stream`. GET returns 405. A notification (no `id`) returns 202.
- **`wait_for_decisions` returns nothing.** It only reports decisions newer than `since`. Omit `since` to wait for the next one. Timeout caps at 25 seconds.
- **Demo research says it does not know this person.** The stand-in only fills the seeded and sample URLs. A real bot should call `attach_profile` itself.
- **Pi camera missing.** That is expected. Use `/scan`. `--capture` prints the same instruction.
- **Link cable is garbage.** Slow the clock with `LINK_HALF_PERIOD_US=400` or flip `LINK_CLK_IDLE=low`. Check the ground and the shifter. The browser dex does not need the cable.
- **ROM will not boot.** Reflash `gameboy/approval.gb`. The header checksum is part of the test suite.

## Hardware risks

The DMG link port is 5 V and the Pi is 3.3 V. A Pi GPIO that sees 5 V from pin 2 is dead. Use the shifter. Do not power the Pi from pin 1. Clock polarity may need one flip on the first cable. The browser path is the demo if the cart or the cable fails.
