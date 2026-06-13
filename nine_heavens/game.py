"""Interactive front-end: character sheet rendering and the main menu loop."""

from __future__ import annotations

import random
import textwrap

from . import cultivation, world
from .character import Character, generate_character


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
    lines = [
        DIVIDER,
        f"  {c.name}    Age {c.age}/{c.max_age}    Reputation {c.reputation}",
        f"  Realm : {c.realm_label}  ({c.realm_cn})",
        f"  Qi    : {bar}  {c.qi:.0f}/{c.qi_to_next:.0f}",
        f"  Power : {c.power:.0f}     HP {c.hp:.0f}/{c.max_hp:.0f}",
        DIVIDER,
        f"  Spiritual Root : {c.root.display}   [{elems}]",
        f"  Physique       : {c.physique_name}",
        f"  Birth Standing : {c.background_name}",
        DIVIDER,
        f"  Comprehension 悟性 {c.comprehension:>3}    Constitution 根骨 {c.constitution:>3}",
        f"  Soul Sense    神识 {c.soul:>3}    Fortune      气运 {c.luck:>3}",
        f"  Charm         魅力 {c.charm:>3}",
        DIVIDER,
        f"  Spirit Stones : {c.spirit_stones}      Qi-Gathering Pills : {c.pills}",
        f"  Techniques    : {', '.join(_tech_names(c))}",
        f"  Inventory     : {', '.join(c.inventory) if c.inventory else '(empty)'}",
        DIVIDER,
    ]
    return "\n".join(lines)


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
    [q] Quit
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

    while c.alive:
        print(render_sheet(c))
        if cultivation.can_breakthrough(c):
            print(f"  ⚑ You stand at a realm wall! Breakthrough chance: "
                  f"{int(cultivation.breakthrough_chance(c) * 100)}%  (option 5)")
        print(MENU)
        try:
            choice = input("  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nYou abandon the dao and vanish into the mortal world. Farewell.")
            return

        if choice in ("q", "quit", "exit"):
            print("\nYou set down the burden of immortality and live out quiet days. Farewell.")
            return
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
        else:
            print(_wrap("The heavens do not understand that command."))

        if c.alive:
            _pause()

    # Death epilogue.
    print()
    print(DIVIDER)
    print("  ☠  THE THREAD OF FATE IS CUT  ☠")
    print(DIVIDER)
    print(_wrap(f"{c.name} perished at age {c.age} — {c.cause_of_death}."))
    print(_wrap(f"Final attainment: {c.realm_label} ({c.realm_cn})."))
    _print_chronicle(c)
    print(_wrap(_epitaph(c)))
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


def _pause() -> None:
    try:
        input("\n  [Enter to continue] ")
    except (EOFError, KeyboardInterrupt):
        raise SystemExit
    print()
