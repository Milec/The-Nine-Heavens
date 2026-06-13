"""Interactive front-end: character sheet rendering and the main menu loop."""

from __future__ import annotations

import random
import textwrap

from . import (alchemy, artifacts, cultivation, dao, data, sect, social,
               world)
from .character import Character, generate_character, reincarnate


BANNER = r"""
   ___ _            _  _ _              _  _
  |_   | |_  ___   | \| (_)_ _  ___    | || |___ __ ___ _____ _ _  ___
   / /| ' \/ -_)  | .` | | ' \/ -_)   | __ / -_) _` \ V / -_) ' \(_-<
  /___|_||_\___|  |_|\_|_|_||_\___|   |_||_\___\__,_|\_/\___|_||_/__/
                    九  重  天  ·  修  仙  录
        A text RPG of cultivation, fortune, and the long climb skyward
"""

DIVIDER = "─" * 64


def _wrap(text: str, indent: str = "  ") -> str:
    return "\n".join(textwrap.fill(line, width=72, initial_indent=indent,
                                   subsequent_indent=indent) if line else ""
                     for line in text.split("\n"))


def render_sheet(c: Character) -> str:
    bar = _qi_bar(c)
    elems = ", ".join(c.root.elements) if c.root and c.root.elements else "—"
    rebirth = (f"  ·  Rebirth #{c.reincarnation_count}"
               if c.reincarnation_count else "")
    lines = [
        DIVIDER,
        f"  {c.name}    Age {c.age}/{c.max_age}    Reputation {c.reputation}{rebirth}",
        f"  Realm : {c.realm_label}  ({c.realm_cn})",
        f"  Qi    : {bar}  {c.qi:.0f}/{c.qi_to_next:.0f}",
        f"  Power : {c.power:.0f}     HP {c.hp:.0f}/{c.max_hp:.0f}"
        f"     Karma: {c.karma:+d} ({c.karma_label})",
        DIVIDER,
        f"  Spiritual Root : {c.root.display}   [{elems}]",
        f"  Physique       : {c.physique_name}",
        f"  Appearance     : {c.appearance_name}",
        f"  Birth Standing : {c.background_name}",
        DIVIDER,
        f"  Comprehension 悟性 {c.comprehension:>3}    Constitution 根骨 {c.constitution:>3}",
        f"  Soul Sense    神识 {c.soul:>3}    Fortune      气运 {c.luck:>3}",
        f"  Charm         魅力 {c.charm:>3}",
        DIVIDER,
        f"  Sect    : {c.sect_name}" + (f"  —  {c.rank_name}" if c.sect_key else ""),
    ]
    if c.sect_key:
        lines.append(f"  Standing: {c.contribution} contribution")
    if c.relationships:
        lines.append(f"  Bonds   : {_relationship_summary(c)}")
    if c.titles:
        lines.append(f"  Titles  : {', '.join(c.titles)}")
    lines.append(DIVIDER)
    art = (artifacts.describe(c.equipped_artifact) if c.equipped_artifact
           else "(none bound)")
    lines.append(f"  Treasure: {art}")
    if c.beast is not None:
        b = c.beast
        lines.append(f"  Beast   : {b.name} the {b.species} "
                     f"({b.tier}, power {b.power:.0f})")
    if c.daos:
        dao_names = ", ".join(data.DAO_BY_KEY[d][1] for d in c.daos)
        lines.append(f"  Daos    : {dao_names}")
    lines += [
        DIVIDER,
        f"  Spirit Stones : {c.spirit_stones}      Spirit Herbs : {c.herbs}",
        f"  Qi Pills : {c.pills}   Healing : {c.healing_pills}   "
        f"Breakthrough : {c.breakthrough_pills}   Alchemy skill : {c.alchemy_skill}",
        f"  Techniques    : {', '.join(_tech_names(c))}",
        f"  Inventory     : {', '.join(c.inventory) if c.inventory else '(empty)'}",
        DIVIDER,
    ]
    return "\n".join(lines)


def _relationship_summary(c: Character) -> str:
    living = [n for n in c.relationships if n.alive]
    if not living:
        return "(none)"
    return "; ".join(f"{n.role_label} {n.name} ({n.status})" for n in living[:6])


def _tech_names(c: Character):
    from . import data
    return [data.TECHNIQUES[t][0] for t in c.techniques if t in data.TECHNIQUES]


def _qi_bar(c: Character, width: int = 20) -> str:
    frac = 0.0 if c.qi_to_next <= 0 else min(1.0, c.qi / c.qi_to_next)
    filled = int(frac * width)
    return "[" + "█" * filled + "░" * (width - filled) + "]"


def print_birth(c: Character) -> None:
    print(BANNER)
    print(DIVIDER)
    print("  ✺  A NEW SOUL ENTERS THE WHEEL OF DESTINY  ✺")
    print(DIVIDER)
    print(_wrap(f"A child is born: {c.name}."))
    print(_wrap(c.omen))
    print()
    print(_wrap(f"Standing — {c.background_name}"))
    print(_wrap(c.background_blurb))
    print()
    print(_wrap(f"Spiritual Root — {c.root.display}"))
    print(_wrap(c.root.blurb))
    print()
    print(_wrap(f"Physique — {c.physique_name}"))
    print(_wrap(c.physique_blurb))
    print()
    print(_wrap(f"Appearance — {c.appearance_name}"))
    print(_wrap(c.appearance_blurb))
    print()
    _birth_verdict(c)
    print(DIVIDER)


def _birth_verdict(c: Character) -> None:
    """A flavourful one-line read on how lucky this birth was."""
    score = (c.root.multiplier * 18 + c.comprehension + c.luck +
             c.reputation + (c.soul + c.constitution) / 2)
    if c.physique_key not in ("ordinary",):
        score += 30
    if score > 170:
        verdict = "The heavens have lavished gifts upon you. A dragon among men."
    elif score > 120:
        verdict = "A genuinely blessed birth. Sects would war over you."
    elif score > 85:
        verdict = "A solid hand of cards. Your fate is yours to make."
    elif score > 55:
        verdict = "An unremarkable start. The climb will be steep but not closed."
    else:
        verdict = "The dao has dealt you ashes. Only sheer will could forge a legend from this."
    print(_wrap(f"✦ {verdict}"))


MENU = """
  What will you do?
    [1] Cultivate in seclusion      [2] Cultivate hard (3 years)
    [3] Use a pill & cultivate      [4] Wander the world (adventure)
    [5] Attempt a breakthrough      [6] View character sheet
    [7] View life chronicle         [8] Help / legend
    [9] Sect affairs                [0] Relationships
    [a] Alchemy (refine pills)      [t] Treasures & beast
    [d] Comprehend the Dao          [q] Quit
"""


def _print_msgs(msgs) -> None:
    for m in msgs:
        if m == "":
            print()
        else:
            print(_wrap(m))


def play(seed=None) -> None:
    rng = random.Random(seed)
    name = None
    try:
        raw = input("Name your cultivator (Enter to let fate decide): ").strip()
        if raw:
            name = raw
    except (EOFError, KeyboardInterrupt):
        pass

    c = generate_character(rng, name=name)
    print_birth(c)
    _pause()

    # The wheel of rebirth: each death may give way to a reincarnated life.
    while True:
        status = _live_one_life(c, rng)
        if status == "quit":
            print("\nYou set down the burden of immortality and live out quiet "
                  "days. Farewell.")
            return
        _death_epilogue(c)
        if _ask("\n  Reincarnate and carry your soul's legacy onward? "
                "([y] yes / anything else to rest) > ") not in ("y", "yes"):
            print(_wrap("Your soul finally rests, its long climb at an end."))
            return
        c = reincarnate(c, rng)
        _print_rebirth(c)
        _pause()


def _live_one_life(c: Character, rng: random.Random) -> str:
    """Run the action loop for a single life. Returns 'quit' or 'died'."""
    while c.alive:
        print(render_sheet(c))
        if cultivation.can_breakthrough(c):
            print(f"  ⚑ You stand at a realm wall! Breakthrough chance: "
                  f"{int(cultivation.breakthrough_chance(c) * 100)}%  (option 5)")
        print(MENU)
        try:
            choice = input("  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            return "quit"

        if choice in ("q", "quit", "exit"):
            return "quit"
        elif choice == "1":
            _print_msgs(cultivation.cultivate(c, rng, years=1))
        elif choice == "2":
            _print_msgs(cultivation.cultivate(c, rng, years=3))
        elif choice == "3":
            if c.pills <= 0:
                print(_wrap("You have no Qi-Gathering Pills."))
            else:
                _print_msgs(cultivation.cultivate(c, rng, years=1, use_pill=True))
        elif choice == "4":
            _print_msgs(world.adventure(c, rng))
        elif choice == "5":
            _print_msgs(cultivation.attempt_breakthrough(c, rng))
        elif choice == "6":
            pass  # sheet prints at top of loop
        elif choice == "7":
            _print_chronicle(c)
        elif choice in ("8", "help", "h", "?"):
            _print_help()
        elif choice == "9":
            _sect_menu(c, rng)
        elif choice == "0":
            _social_menu(c, rng)
        elif choice == "a":
            _alchemy_menu(c, rng)
        elif choice == "t":
            _treasure_menu(c, rng)
        elif choice == "d":
            _print_msgs(dao.meditate(c, rng, years=1))
        else:
            print(_wrap("The heavens do not understand that command."))

        if c.alive:
            _pause()
    return "died"


def _death_epilogue(c: Character) -> None:
    print()
    print(DIVIDER)
    print("  ☠  THE THREAD OF FATE IS CUT  ☠")
    print(DIVIDER)
    print(_wrap(f"{c.name} perished at age {c.age} — {c.cause_of_death}."))
    print(_wrap(f"Final attainment: {c.realm_label} ({c.realm_cn})."))
    if c.daos:
        print(_wrap(f"Daos comprehended: "
                    f"{', '.join(data.DAO_BY_KEY[d][1] for d in c.daos)}."))
    _print_chronicle(c)
    print(_wrap(_epitaph(c)))
    print(DIVIDER)


def _print_rebirth(c: Character) -> None:
    print()
    print(DIVIDER)
    print("  ☯  THE WHEEL OF REBIRTH TURNS  ☯")
    print(DIVIDER)
    print(_wrap(f"A new soul is born — {c.name} (Rebirth #{c.reincarnation_count}) "
                f"— stirred by faint memories of a former life."))
    print(_wrap(f"Spiritual Root — {c.root.display}"))
    print(_wrap(f"Standing — {c.background_name}"))
    print(_wrap("The legacy of your past climb sharpens your innate talent. "
                "Begin again, and climb higher."))
    print(DIVIDER)


def _epitaph(c: Character) -> str:
    if c.realm >= 9:
        return "✦ A name that will echo through the Nine Heavens for ten thousand years."
    if c.realm >= 6:
        return "✦ A grand monarch of an age, remembered in a hundred sects' annals."
    if c.realm >= 4:
        return "✦ A true cultivator who touched immortality's hem before the end."
    if c.realm >= 2:
        return "✦ A diligent seeker who climbed further than most ever dare."
    return "✦ One more soul the great dao swallowed without a ripple. Try again."


def _print_chronicle(c: Character) -> None:
    print(DIVIDER)
    print("  Life Chronicle")
    print(DIVIDER)
    for age, text in c.log[-18:]:
        print(_wrap(f"Age {age:>4} — {text}", indent="  "))


def _ask(prompt: str) -> str:
    try:
        return input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        return "b"


def _sect_menu(c: Character, rng: random.Random) -> None:
    """Sect affairs: join, climb ranks, quests, tournaments, the sect store."""
    print(DIVIDER)
    if not c.sect_key:
        print("  SECT HALLS — you are an unaffiliated rogue cultivator.")
        print("  A sect grants cultivation resources, quests, and comrades.")
        print(DIVIDER)
        for i, s in enumerate(data.SECTS, 1):
            chance = sect.join_chance(c, s)
            gate = (f"{int(chance * 100)}% to be accepted" if c.realm >= s[5]
                    else f"needs {data.REALMS[s[5]][0]}")
            print(_wrap(f"[{i}] {s[1]}  ·  {s[2]}  ·  {gate}"))
            print(_wrap(s[9], indent="      "))
        choice = _ask("\n  Apply to which sect? (number, or [b] back) > ")
        if choice.isdigit() and 1 <= int(choice) <= len(data.SECTS):
            _print_msgs(sect.attempt_join(c, rng, data.SECTS[int(choice) - 1][0]))
        return

    # --- Already a member ---
    print(f"  {c.sect_name}  —  {c.rank_name}")
    print(f"  Contribution: {c.contribution}")
    req = sect.next_rank_requirements(c)
    if req:
        name, mr, mc = req
        ready = "READY" if sect.can_promote(c) else \
            f"needs {data.REALMS[mr][0]} & {mc} contribution"
        print(_wrap(f"  Next rank: {name}  ({ready})"))
    print(DIVIDER)
    print("""  [1] Take a contribution quest   [2] Attempt promotion
  [3] Enter the grand tournament  [4] Visit the sect store (25 contrib)
  [5] Leave the sect              [b] Back""")
    choice = _ask("\n  > ")
    if choice == "1":
        quests = sect.available_quests(c)
        print(DIVIDER)
        for i, q in enumerate(quests, 1):
            print(_wrap(f"[{i}] {q[0]}  (+{q[2]} contrib, +{q[3]} stones, "
                        f"risk {int(q[4] * 100)}%)"))
        pick = _ask("\n  Accept which quest? (number, or [b]) > ")
        if pick.isdigit() and 1 <= int(pick) <= len(quests):
            _print_msgs(sect.do_quest(c, rng, quests[int(pick) - 1]))
    elif choice == "2":
        _print_msgs(sect.attempt_promotion(c, rng))
    elif choice == "3":
        _print_msgs(sect.tournament(c, rng))
    elif choice == "4":
        _print_msgs(sect.exchange_contribution(c, rng))
    elif choice == "5":
        _print_msgs(sect.leave_sect(c))


def _social_menu(c: Character, rng: random.Random) -> None:
    """Relationships: spend time with the people in your life."""
    print(DIVIDER)
    print("  RELATIONSHIPS")
    print(DIVIDER)
    living = [n for n in c.relationships if n.alive]
    if not living:
        print(_wrap("You walk the dao alone -- no bonds, no burdens. Go out and "
                    "meet someone."))
    for i, n in enumerate(living, 1):
        print(_wrap(f"[{i}] {n.role_label} {n.name}  ·  {n.status} "
                    f"(affinity {n.affinity:+d})"))
    print()
    print("  [n] Go out and meet people      [b] Back")
    choice = _ask("\n  Spend a year with whom? (number / n / b) > ")
    if choice == "n":
        _print_msgs(social.meet_new(c, rng))
    elif choice.isdigit() and 1 <= int(choice) <= len(living):
        _print_msgs(social.interact_with(c, living[int(choice) - 1], rng))


def _alchemy_menu(c: Character, rng: random.Random) -> None:
    """The pill furnace: refine gathered herbs into pills."""
    print(DIVIDER)
    print(f"  ALCHEMY — Spirit Herbs: {c.herbs}   Alchemy skill: {c.alchemy_skill}")
    print(DIVIDER)
    for i, r in enumerate(data.PILL_RECIPES, 1):
        key, name, cost, _base, blurb = r
        chance = int(alchemy.success_chance(c, r) * 100)
        print(_wrap(f"[{i}] {name}  ({cost} herbs, {chance}% success)"))
        print(_wrap(blurb, indent="      "))
    choice = _ask("\n  Refine which pill? (number, or [b] back) > ")
    if choice.isdigit() and 1 <= int(choice) <= len(data.PILL_RECIPES):
        _print_msgs(alchemy.refine(c, rng, data.PILL_RECIPES[int(choice) - 1][0]))


def _treasure_menu(c: Character, rng: random.Random) -> None:
    """Inspect and bind magic treasures, and check on your spirit beast."""
    print(DIVIDER)
    print("  TREASURES & SPIRIT BEAST")
    print(DIVIDER)
    if c.beast is not None:
        b = c.beast
        print(_wrap(f"Spirit beast: {b.name} the {b.species} "
                    f"({b.tier}, power {b.power:.0f}, loyalty {b.loyalty})"))
    else:
        print(_wrap("Spirit beast: none. Best a wild beast while wandering to "
                    "try taming one."))
    print()
    if not c.artifacts:
        print(_wrap("You own no magic treasures yet. Ruins, auctions and fallen "
                    "foes may yet yield one."))
        return
    print("  Your treasures (★ = bound):")
    for i, key in enumerate(c.artifacts, 1):
        star = "★" if key == c.equipped_artifact else " "
        print(_wrap(f"{star}[{i}] {artifacts.describe(key)}"))
    choice = _ask("\n  Bind which treasure? (number, or [b] back) > ")
    if choice.isdigit() and 1 <= int(choice) <= len(c.artifacts):
        _print_msgs(artifacts.equip(c, c.artifacts[int(choice) - 1]))


def _print_help() -> None:
    from . import data
    print(DIVIDER)
    print("  THE NINE HEAVENS — A QUICK LEGEND")
    print(DIVIDER)
    print(_wrap(
        "Your goal is to climb the realms of cultivation from a frail mortal "
        "toward Immortal Ascension, surviving lifespan, tribulation and blade."))
    print(_wrap("Cultivation realms, lowest to highest:"))
    for i, (name, cn, *_rest) in enumerate(data.REALMS):
        print(_wrap(f"{i}. {name} ({cn})", indent="    "))
    print()
    print(_wrap(
        "Cultivate to fill your qi bar and advance stages automatically. At a "
        "realm's peak you hit a 'wall' and must deliberately attempt a "
        "breakthrough (option 5) — risky, and from the Golden Core upward it "
        "summons a Heavenly Tribulation. Wandering (option 4) earns resources "
        "and danger. Fortune (气运) quietly improves every roll you make."))
    print()
    print(_wrap(
        "Sect affairs (option 9): join one of the great sects — better sects "
        "demand rarer spiritual roots — to gain a cultivation-speed bonus, a "
        "yearly stipend, and a rank ladder from Outer Disciple to Sect Master. "
        "Run contribution quests, spend contribution at the sect store, and "
        "enter the grand tournament for renown and rewards."))
    print()
    print(_wrap(
        "Relationships (option 0): spend years among people to forge bonds. A "
        "Master sharpens your insight and gifts techniques; a Rival's sparring "
        "drives you both; Friends bring gifts; a Dao Companion's dual "
        "cultivation surges your qi; Enemies may one day draw their blades. "
        "Charm and appearance decide who you draw to your side."))
    print()
    print(_wrap(
        "Alchemy (option a): refine gathered spirit herbs into pills — qi, "
        "healing and breakthrough pills, body/soul tonics, and the prized "
        "Longevity Pill that buys you extra years. Treasures & beast (option "
        "t): bind your strongest magic treasure (法宝) for more power and "
        "faster cultivation, and check on a spirit beast tamed in the wild — "
        "both give a real edge over your peers, since foes scale only to your "
        "base strength."))
    print()
    print(_wrap(
        "Comprehend the Dao (option d): from Nascent Soul upward, meditate to "
        "grasp the great Laws (Sword, Time, Slaughter, Karma...), each "
        "permanently raising power and easing breakthroughs — the true road to "
        "ascension. Karma (业力) tracks merit and sin: virtue softens the "
        "Heavenly Tribulation, while a blood-soaked soul must also master the "
        "heart demon. And when at last you die, your soul may reincarnate, "
        "carrying its hard-won legacy into a new life."))


def _pause() -> None:
    try:
        input("\n  [Enter to continue] ")
    except (EOFError, KeyboardInterrupt):
        raise SystemExit
    print()
