#!/usr/bin/env python3
"""Re-take the screenshots in docs/images from a running server.

Screenshots go stale the moment the UI moves, and nobody re-takes them by hand
across seventeen files. This drives a real browser over a seeded local server
and writes every image the documentation uses, under the name the docs expect.

    pip install playwright && playwright install chromium
    SITE_ADMIN_PASSWORD=devpass python flask_app.py &
    python tools/seed-demo-game.py --base-url http://127.0.0.1:5000
    python tools/capture-screenshots.py --admin-password devpass

Shots are captured in phases, because some of them need the game in a
particular state, and the script moves it there through the API between phases:
the seeded games first, then the bonus round, then the admin panel once a game
has ended. Running the whole thing takes about a minute and leaves both games
finished, so re-seed a fresh database before running it again.

Pass one or more shot names to capture only those - `--only player-game
host-panel` - and remember that a shot from a later phase still runs the
transitions ahead of it.

Map tiles are blocked by default, which is why the committed screenshots have
no backdrop: the pages that show a map say so, and a blocked tile keeps the
images identical whatever OpenStreetMap looks like this month. Pass --tiles to
let them load.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("This needs Playwright: pip install playwright "
             "&& playwright install chromium")

PHONE = {"width": 390, "height": 844}
DESK = {"width": 1700, "height": 900}
BANK = {"width": 900, "height": 1200}


class Shooter:
    def __init__(self, browser, seed, out_dir, block_tiles):
        self.browser = browser
        self.seed = seed
        self.out_dir = out_dir
        self.block_tiles = block_tiles
        self.written = []

    def page(self, viewport=None, scale=2, geo=None):
        viewport = viewport or PHONE
        latitude, longitude = geo or self.seed["centre"]
        context = self.browser.new_context(
            viewport=viewport, device_scale_factor=scale, locale="en-GB",
            geolocation={"latitude": latitude, "longitude": longitude},
            permissions=["geolocation"])
        page = context.new_page()
        if self.block_tiles:
            page.route("**tile.openstreetmap.org**", lambda route: route.abort())
        return context, page

    def save(self, page, name, full=False, height=None, width=None):
        path = os.path.join(self.out_dir, name + ".png")
        if height:
            page.screenshot(path=path, clip={
                "x": 0, "y": 0, "width": width or page.viewport_size["width"],
                "height": height})
        else:
            page.screenshot(path=path, full_page=full)
        self.written.append(name)
        print(f"  {name}.png")

    def save_section(self, page, name, section_id, max_height):
        """Clip a host-panel section, scrolled to the top of the viewport."""
        section = page.locator(f"#{section_id}-body").locator("xpath=..")
        section.evaluate("el => el.scrollIntoView({block: 'start'})")
        page.wait_for_timeout(700)
        box = section.bounding_box()
        path = os.path.join(self.out_dir, name + ".png")
        page.screenshot(path=path, clip={
            "x": 0, "y": max(0, box["y"] - 8),
            "width": page.viewport_size["width"],
            "height": min(max_height, box["height"] + 16)})
        self.written.append(name)
        print(f"  {name}.png")

    def open_host_panel(self, page, game_name):
        """Enrol as the host and open one game by name."""
        page.goto(self.seed["base_url"] + "/?id=" + self.seed["host"]["qr_code"],
                  wait_until="networkidle")
        page.wait_for_timeout(2000)
        page.get_by_role("button", name="OK, got it").click()
        page.wait_for_timeout(6000)      # let the welcome toast clear
        page.evaluate("""(name) => {
            const cards = [...document.querySelectorAll('#host-games-list *')]
                .filter(el => el.textContent.includes(name)
                              && el.querySelector('button'));
            cards[cards.length - 1].querySelector('button').click();
        }""", game_name)
        page.wait_for_timeout(3500)

    def join_as_player(self, page, team_qr):
        page.goto(self.seed["base_url"] + "/?id=" + team_qr,
                  wait_until="networkidle")
        page.wait_for_timeout(800)
        page.get_by_role("button", name="Join Team").click()
        page.wait_for_timeout(6500)      # let the join toast clear

    def sign_in_as_admin(self, page, password):
        page.goto(self.seed["base_url"] + "/", wait_until="networkidle")
        page.wait_for_timeout(1200)
        page.locator("header button").last.click()
        page.wait_for_timeout(1000)
        page.get_by_text("Site administration").click()
        page.wait_for_timeout(1500)
        page.locator("input[type=password]").fill(password)
        page.keyboard.press("Enter")
        page.wait_for_timeout(6000)      # and the sign-in toast


# --------------------------------------------------------------------------
# The shots, in the order they have to be taken

def shot_welcome(s):
    context, page = s.page()
    page.goto(s.seed["base_url"] + "/", wait_until="networkidle")
    page.wait_for_timeout(1200)
    s.save(page, "welcome", height=700)
    context.close()


def shot_player(s, wanted):
    context, page = s.page()
    team = s.seed["game"]["teams"][0]
    page.goto(s.seed["base_url"] + "/?id=" + team["qr"], wait_until="networkidle")
    page.wait_for_timeout(1200)
    if "player-join" in wanted:
        s.save(page, "player-join", full=True)
    if wanted & {"player-game", "player-messages", "app-menu"}:
        page.get_by_role("button", name="Join Team").click()
        page.wait_for_timeout(6500)
        if "player-game" in wanted:
            s.save(page, "player-game", height=844)
        if "player-messages" in wanted:
            page.locator("header button").first.click()
            page.wait_for_timeout(1500)
            s.save(page, "player-messages", height=700)
            page.get_by_role("button", name="Close").click()
            page.wait_for_timeout(800)
        if "app-menu" in wanted:
            page.locator("header button").last.click()
            page.wait_for_timeout(1200)
            s.save(page, "app-menu", height=700)
    context.close()


def shot_host(s, wanted):
    context, page = s.page()
    page.goto(s.seed["base_url"] + "/?id=" + s.seed["host"]["qr_code"],
              wait_until="networkidle")
    page.wait_for_timeout(2000)
    page.get_by_role("button", name="OK, got it").click()
    page.wait_for_timeout(6000)
    if "host-games" in wanted:
        s.save_section(page, "host-games", "host-existing-games", 620)
    page.evaluate("""(name) => {
        const cards = [...document.querySelectorAll('#host-games-list *')]
            .filter(el => el.textContent.includes(name) && el.querySelector('button'));
        cards[cards.length - 1].querySelector('button').click();
    }""", "Riverside Park Challenge")
    page.wait_for_timeout(3500)
    if "host-panel" in wanted:
        s.save(page, "host-panel", height=844)
    if "host-teams" in wanted:
        s.save_section(page, "host-teams", "game-teams", 620)
    if "host-bases" in wanted:
        s.save_section(page, "host-bases", "game-bases", 760)
    context.close()


def shot_host_settings(s):
    # Captured from the quiz game so the quiz options are on screen. The modal
    # scrolls, so its height cap is lifted to get the whole form in one image.
    context, page = s.page(viewport={"width": 390, "height": 1400})
    s.open_host_panel(page, "Quiz Trail")
    page.get_by_role("button", name="Edit Settings").click()
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
        const modal = [...document.querySelectorAll('div')]
            .find(d => (d.className || '').includes('max-h-[90vh]'));
        if (modal) { modal.style.maxHeight = 'none'; modal.style.overflow = 'visible'; }
    }""")
    page.wait_for_timeout(800)
    modal = page.locator("div").filter(has_text="Edit Game Settings").last
    modal.screenshot(path=os.path.join(s.out_dir, "host-settings.png"))
    s.written.append("host-settings")
    print("  host-settings.png")
    context.close()


def shot_question_bank(s):
    # Building a bank is desk work, so it is captured at a laptop width.
    context, page = s.page(viewport=BANK, scale=1.5)
    page.goto(s.seed["base_url"] + "/?id=" + s.seed["host"]["qr_code"],
              wait_until="networkidle")
    page.wait_for_timeout(2000)
    page.get_by_role("button", name="OK, got it").click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="Manage Question Bank").first.click()
    page.wait_for_timeout(2500)
    s.save(page, "question-bank", height=1000, width=BANK["width"])
    context.close()


def shot_quiz(s):
    base = s.seed["quiz_game"]["bases"][0]
    context, page = s.page(geo=(base["lat"], base["lng"]))
    s.join_as_player(page, s.seed["quiz_game"]["teams"][0]["qr"])
    page.evaluate("code => window.handleQRCode(code, 'scan')", base["qr"])
    page.wait_for_timeout(3500)
    s.save(page, "quiz-question", height=700)
    context.close()


def shot_generator(s):
    context, page = s.page(viewport={"width": 1180, "height": 900}, scale=1.5)
    page.goto(s.seed["base_url"] + "/code-generator/", wait_until="networkidle")
    page.wait_for_timeout(2500)
    s.save(page, "code-generator")
    context.close()


def shot_bonus_host(s):
    context, page = s.page()
    s.open_host_panel(page, "Riverside Park Challenge")
    s.save_section(page, "host-bonus", "game-control", 720)
    context.close()


def shot_bonus_player(s):
    context, page = s.page()
    game, player = s.seed["game"], s.seed["game"]["players"][0]
    context.add_init_script(script="""
        localStorage.setItem('gameId', %r);
        localStorage.setItem('teamId', %r);
        localStorage.setItem('playerId', %r);
        localStorage.setItem('playerName', %r);
    """ % (game["id"], player["team"], player["id"], player["name"]))
    page.goto(s.seed["base_url"] + "/", wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="Continue Game").click()
    page.wait_for_timeout(3000)
    if page.get_by_role("button", name="OK, got it").count():
        page.get_by_role("button", name="OK, got it").click()
    page.wait_for_timeout(4000)
    s.save(page, "player-bonus", height=844)
    context.close()


def shot_admin(s, wanted, password):
    context, page = s.page(viewport=DESK, scale=1.5)
    s.sign_in_as_admin(page, password)
    if "admin-hosts" in wanted:
        s.save(page, "admin-hosts", height=620, width=DESK["width"])
    if "admin-games" in wanted:
        page.get_by_role("button", name="Game Management").click()
        page.wait_for_timeout(2500)
        s.save(page, "admin-games", height=700, width=DESK["width"])
    context.close()


# Phase name -> (shots it can take, what the game has to look like first)
PHASES = [
    ("seeded", {"welcome", "player-join", "player-game", "player-messages",
                "app-menu", "host-games", "host-panel", "host-teams",
                "host-bases", "host-settings", "question-bank",
                "quiz-question", "code-generator"}),
    ("bonus", {"host-bonus", "player-bonus"}),
    ("ended", {"admin-hosts", "admin-games"}),
]
ALL_SHOTS = sorted(shot for _, shots in PHASES for shot in shots)


def start_bonus_round(api, seed):
    """Move the main game into its bonus round, and collect a base or two."""
    game, host_id = seed["game"], seed["host"]["id"]
    api("POST", f"/api/games/{game['id']}/bonus/start", {"host_id": host_id})
    first, second = game["bases"][0], game["bases"][1]
    for base, player in ((first, game["players"][0]),
                         (second, game["players"][3])):
        api("POST", f"/api/bases/{base['id']}/collect",
            {"player_id": player["id"], "latitude": base["lat"],
             "longitude": base["lng"], "qr_code": base["qr"]})
    # One of them handed back, so the host's checklist shows all three states
    api("POST", f"/api/bases/{second['id']}/return", {"host_id": host_id})


def end_quiz_game(api, seed):
    """End the quiz game, so the admin table shows a finished one."""
    api("POST", f"/api/games/{seed['quiz_game']['id']}/end",
        {"host_id": seed["host"]["id"]})


def api_caller(base_url):
    """A minimal JSON caller, for the state changes between phases."""
    def call(method, path, body):
        data = json.dumps(body).encode()
        request = urllib.request.Request(base_url.rstrip("/") + path,
                                         data=data, method=method)
        request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            sys.exit(f"{method} {path} failed: {error.code} "
                     f"{error.read().decode()[:300]}")
    return call


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--seed", default="demo-game.json",
                        help="the file tools/seed-demo-game.py wrote "
                             "(default: %(default)s)")
    parser.add_argument("--out", default="docs/images",
                        help="where the images go (default: %(default)s)")
    parser.add_argument("--admin-password",
                        default=os.environ.get("SITE_ADMIN_PASSWORD"),
                        help="needed for the admin panel shots "
                             "(default: $SITE_ADMIN_PASSWORD)")
    parser.add_argument("--chromium",
                        default=os.environ.get("PLAYWRIGHT_CHROMIUM"),
                        help="path to a Chromium binary, if Playwright's own "
                             "download is not where it expects")
    parser.add_argument("--tiles", action="store_true",
                        help="let OpenStreetMap tiles load into the maps")
    parser.add_argument("--only", nargs="+", metavar="SHOT",
                        help="capture only these: " + ", ".join(ALL_SHOTS))
    args = parser.parse_args()

    if not os.path.exists(args.seed):
        sys.exit(f"No seed file at {args.seed}. Run tools/seed-demo-game.py "
                 f"against a running server first.")
    seed = json.load(open(args.seed, encoding="utf-8"))

    wanted = set(args.only or ALL_SHOTS)
    unknown = wanted - set(ALL_SHOTS)
    if unknown:
        sys.exit(f"Unknown shot(s): {', '.join(sorted(unknown))}\n"
                 f"Known: {', '.join(ALL_SHOTS)}")
    if wanted & {"admin-hosts", "admin-games"} and not args.admin_password:
        sys.exit("The admin shots need SITE_ADMIN_PASSWORD or "
                 "--admin-password.")

    os.makedirs(args.out, exist_ok=True)
    api = api_caller(seed["base_url"])
    last_phase = max(index for index, (_, shots) in enumerate(PHASES)
                     if wanted & shots)

    launch = {"executable_path": args.chromium} if args.chromium else {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch)
        shooter = Shooter(browser, seed, args.out, not args.tiles)

        for index, (phase, shots) in enumerate(PHASES):
            if index > last_phase:
                break
            if phase == "bonus":
                print("Starting the bonus round...")
                start_bonus_round(api, seed)
            elif phase == "ended":
                print("Ending the quiz game...")
                end_quiz_game(api, seed)

            todo = wanted & shots
            if not todo:
                continue
            print(f"{phase}:")
            if phase == "seeded":
                if "welcome" in todo:
                    shot_welcome(shooter)
                if todo & {"player-join", "player-game", "player-messages",
                           "app-menu"}:
                    shot_player(shooter, todo)
                if todo & {"host-games", "host-panel", "host-teams",
                           "host-bases"}:
                    shot_host(shooter, todo)
                if "host-settings" in todo:
                    shot_host_settings(shooter)
                if "question-bank" in todo:
                    shot_question_bank(shooter)
                if "quiz-question" in todo:
                    shot_quiz(shooter)
                if "code-generator" in todo:
                    shot_generator(shooter)
            elif phase == "bonus":
                if "host-bonus" in todo:
                    shot_bonus_host(shooter)
                if "player-bonus" in todo:
                    shot_bonus_player(shooter)
            else:
                shot_admin(shooter, todo, args.admin_password)

        browser.close()

    print(f"\n{len(shooter.written)} screenshot(s) written to {args.out}")


if __name__ == "__main__":
    main()
