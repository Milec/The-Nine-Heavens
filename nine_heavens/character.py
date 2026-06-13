"""The cultivator: birth generation, attributes, and progression state."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Optional

from . import data


def _weighted_choice(rng: random.Random, table, weight_index: int):
    """Pick one row from a table of tuples using one column as the weight."""
    weights = [row[weight_index] for row in table]
    return rng.choices(table, weights=weights, k=1)[0]


def _roll_attribute(rng: random.Random, low: int = 1, high: int = 100) -> int:
    """Roll an innate attribute using a mild bell curve (3d-style)."""
    span = high - low
    r = (rng.random() + rng.random() + rng.random()) / 3.0
    return low + int(round(r * span))


@dataclass
class SpiritualRoot:
    key: str
    display: str
    multiplier: float
    comprehension_bonus: int
    elements: list
    blurb: str

    @property
    def is_mortal(self) -> bool:
        return self.key == "none"


@dataclass
class Character:
    name: str = "Nameless"
    age: int = 0

    # Birth-rolled identity (these barely change over a lifetime)
    root: Optional[SpiritualRoot] = None
    physique_key: str = "ordinary"
    physique_name: str = "Ordinary Body (凡体)"
    physique_blurb: str = ""
    background_key: str = "peasant"
    background_name: str = ""
    background_blurb: str = ""
    omen: str = ""
    appearance_key: str = "ordinary"
    appearance_name: str = "Ordinary (寻常)"
    appearance_blurb: str = ""

    # Core attributes
    comprehension: int = 30   # 悟性 -- speed of insight & breakthrough chance
    constitution: int = 30    # 根骨 -- body strength & health
    soul: int = 30            # 神识 -- spirit sense, vital at higher realms
    luck: int = 30            # 气运 -- nudges every random roll in your favour
    charm: int = 30           # 魅力 -- social fortune

    # Progression
    realm: int = 0            # index into data.REALMS
    stage: int = 0            # minor stage within the realm
    qi: float = 0.0           # accumulated qi toward the next stage
    max_age: int = 80         # current lifespan ceiling

    # Resources & belongings
    spirit_stones: int = 0
    reputation: int = 0
    techniques: list = field(default_factory=lambda: ["basic_breathing"])
    inventory: list = field(default_factory=list)
    pills: int = 0            # generic "qi-gathering pills" you can pop to cultivate faster

    # Sect membership
    sect_key: Optional[str] = None
    sect_rank: int = 0        # index into data.SECT_RANKS
    contribution: int = 0     # sect contribution points
    titles: list = field(default_factory=list)  # tournament honours, etc.

    # Relationships -- a list of NPC objects (see social.py)
    relationships: list = field(default_factory=list)

    # Crafting, treasures and companions
    herbs: int = 0                      # spirit herbs, the raw stock of alchemy
    healing_pills: int = 0              # auto-consumed in dire combat
    breakthrough_pills: int = 0         # consumed to boost a breakthrough
    alchemy_skill: int = 0              # grows with every pill refined
    artifacts: list = field(default_factory=list)   # owned artifact keys
    equipped_artifact: Optional[str] = None         # key of bound treasure
    beast: object = None                # tamed spirit beast (see beasts.py)

    # Dao comprehension and karma
    daos: list = field(default_factory=list)        # comprehended Dao keys
    dao_insight: float = 0.0            # progress toward the next Dao
    karma: int = 0                      # 业力: merit (+) vs sin (-)
    reincarnation_count: int = 0        # how many past lives this soul recalls

    # Combat-ish derived pools
    hp: float = 50.0
    max_hp: float = 50.0

    alive: bool = True
    cause_of_death: str = ""
    log: list = field(default_factory=list)

    # ----- derived stats -------------------------------------------------

    @property
    def realm_name(self) -> str:
        return data.REALMS[self.realm][0]

    @property
    def realm_cn(self) -> str:
        return data.REALMS[self.realm][1]

    @property
    def realm_stages(self) -> int:
        return data.REALMS[self.realm][2]

    @property
    def realm_label(self) -> str:
        stage = data.stage_label(self.stage, self.realm_stages)
        if stage:
            return f"{self.realm_name} – {stage}"
        return self.realm_name

    @property
    def qi_to_next(self) -> float:
        return data.REALMS[self.realm][4] * (1 + self.stage * 0.55)

    @property
    def technique_qi_bonus(self) -> float:
        return sum(data.TECHNIQUES[t][2] for t in self.techniques if t in data.TECHNIQUES)

    @property
    def technique_atk_bonus(self) -> int:
        return sum(data.TECHNIQUES[t][3] for t in self.techniques if t in data.TECHNIQUES)

    @property
    def sect(self):
        """The sect tuple this cultivator belongs to, or None."""
        return data.SECT_BY_KEY.get(self.sect_key) if self.sect_key else None

    @property
    def sect_name(self) -> str:
        return self.sect[1] if self.sect else "Rogue Cultivator (散修)"

    @property
    def rank_name(self) -> str:
        return data.SECT_RANKS[self.sect_rank][0] if self.sect else ""

    @property
    def sect_speed_bonus(self) -> float:
        """Cultivation-speed bonus from the sect's arrays plus your rank."""
        if not self.sect:
            return 0.0
        return self.sect[7] + data.SECT_RANKS[self.sect_rank][3]

    @property
    def artifact(self):
        """The equipped artifact tuple, or None."""
        return data.ARTIFACT_BY_KEY.get(self.equipped_artifact) \
            if self.equipped_artifact else None

    @property
    def artifact_atk_pct(self) -> float:
        return self.artifact[3] if self.artifact else 0.0

    @property
    def artifact_qi_bonus(self) -> float:
        return self.artifact[4] if self.artifact else 0.0

    @property
    def dao_power_bonus(self) -> float:
        return sum(data.DAO_BY_KEY[d][2] for d in self.daos if d in data.DAO_BY_KEY)

    @property
    def dao_breakthrough_bonus(self) -> float:
        return sum(data.DAO_BY_KEY[d][3] for d in self.daos if d in data.DAO_BY_KEY)

    @property
    def beast_power(self) -> float:
        """Combat power your tamed beast contributes, if any."""
        b = self.beast
        return b.power if (b and getattr(b, "alive", True)) else 0.0

    @property
    def cultivation_speed(self) -> float:
        """How fast qi accumulates per year of seclusion.

        Crucially this scales with the realm so that the ever-steeper qi
        requirements stay reachable -- talent (root) and insight (comprehension)
        then decide whether you outrun your lifespan. Sect resources, a bound
        treasure and the Dao of Time all stack further multipliers on top."""
        root_mult = self.root.multiplier if self.root else 0.1
        comp = 0.55 + self.comprehension / 70.0
        realm_factor = data.REALMS[self.realm][4] ** 0.5
        time_dao = 0.25 if "time" in self.daos else 0.0
        return (root_mult * comp * (1 + self.technique_qi_bonus)
                * realm_factor * 1.8
                * (1 + self.sect_speed_bonus + self.artifact_qi_bonus + time_dao))

    @property
    def base_power(self) -> float:
        """Combat strength from realm, body, soul and technique alone.

        Foes, tournament rivals and tribulation bolts are scaled against this so
        that treasures, Daos and beasts grant a *real* edge over your peers
        rather than cancelling out."""
        realm_factor = (self.realm * 10 + self.stage + 1)
        base = realm_factor ** 2.1
        body = self.constitution * 0.8
        soul = self.soul * 0.5
        return base * (1 + body / 100 + soul / 100) \
            + self.technique_atk_bonus * realm_factor

    @property
    def power(self) -> float:
        """Full combat strength: base plus a bound treasure, comprehended Daos
        and any spirit beast fighting at your side."""
        raw = self.base_power * (1 + self.artifact_atk_pct + self.dao_power_bonus)
        return raw + self.beast_power

    @property
    def karma_label(self) -> str:
        return data.karma_label(self.karma)

    # ----- helpers -------------------------------------------------------

    def note(self, text: str) -> None:
        self.log.append((self.age, text))

    def recompute_max_hp(self) -> None:
        realm_factor = (self.realm * 10 + self.stage + 1)
        self.max_hp = 40 + self.constitution * 1.5 + realm_factor * 12
        self.hp = min(self.hp, self.max_hp) if self.hp > 0 else self.max_hp


# ---------------------------------------------------------------------------
# Birth generation -- where the heavens roll the dice on your whole life.
# ---------------------------------------------------------------------------

def _make_name(rng: random.Random) -> str:
    surname = rng.choice(data.SURNAMES)
    given = rng.choice(data.GIVEN_FIRST)
    if rng.random() < 0.6:
        given += rng.choice(data.GIVEN_SECOND)
    return f"{surname} {given}"


def _roll_root(rng: random.Random) -> SpiritualRoot:
    key, display, mult, comp, _w, blurb = _weighted_choice(rng, data.ROOT_TYPES, 4)
    elements: list = []
    if key == "none":
        elements = []
    elif key == "waste":
        elements = list(data.ELEMENTS)
    elif key == "quad":
        elements = rng.sample(data.ELEMENTS, 4)
    elif key == "triple":
        elements = rng.sample(data.ELEMENTS, 3)
    elif key == "dual":
        elements = rng.sample(data.ELEMENTS, 2)
    elif key == "heavenly":
        elements = [rng.choice(data.ELEMENTS)]
    elif key == "variant":
        elements = [rng.choice(data.VARIANT_ELEMENTS)]
    elif key == "chaos":
        elements = ["Chaos"]
    # A little spread on the multiplier so two heavenly roots aren't identical.
    mult = round(mult * rng.uniform(0.9, 1.12), 3)
    return SpiritualRoot(key, display, mult, comp, elements, blurb)


def generate_character(rng: Optional[random.Random] = None,
                       name: Optional[str] = None) -> Character:
    """Roll a brand new cultivator from the moment of birth."""
    rng = rng or random.Random()

    c = Character()
    c.name = name or _make_name(rng)

    # 1) Spiritual root -- the great talent die.
    c.root = _roll_root(rng)

    # 2) Special physique.
    pk, pdisp, pblurb, body_m, qi_m, soul_m, luck_b, _w = _weighted_choice(
        rng, data.PHYSIQUES, 7)
    c.physique_key, c.physique_name, c.physique_blurb = pk, pdisp, pblurb

    # 3) Birth standing.
    bk, bdisp, bblurb, rep, stones, items, _w = _weighted_choice(
        rng, data.BACKGROUNDS, 6)
    c.background_key, c.background_name, c.background_blurb = bk, bdisp, bblurb
    c.reputation = rep
    c.spirit_stones = stones
    c.inventory = list(items)

    # 4) Birth omen.
    omen, o_comp, o_body, o_soul, o_luck, _w = _weighted_choice(
        rng, data.BIRTH_OMENS, 5)
    c.omen = omen

    # 4b) Appearance -- its own roll, and a heavy thumb on the Charm scale.
    ak, adisp, charm_bonus, ablurb, _w = _weighted_choice(
        rng, data.APPEARANCES, 4)
    c.appearance_key, c.appearance_name, c.appearance_blurb = ak, adisp, ablurb

    # 5) Core attributes, then layer on every modifier above.
    c.comprehension = _roll_attribute(rng) + c.root.comprehension_bonus + o_comp
    c.constitution = _roll_attribute(rng) + o_body
    c.soul = _roll_attribute(rng) + o_soul
    c.luck = _roll_attribute(rng) + luck_b + o_luck
    c.charm = _roll_attribute(rng) + charm_bonus

    # Physique scaling acts on the body/soul attributes.
    c.constitution = int(round(c.constitution * body_m))
    c.soul = int(round(c.soul * soul_m))
    # Stash the qi physique multiplier on the root for cultivation speed.
    if qi_m != 1.0:
        c.root.multiplier = round(c.root.multiplier * qi_m, 3)

    # Standing-based attribute nudges (nurture follows nature).
    nurture = {
        "scholar": ("comprehension", 8), "noble": ("comprehension", 6),
        "royal": ("luck", 10), "martial": ("constitution", 10),
        "hermit": ("comprehension", 12), "demon": ("soul", 8),
        "slave": ("constitution", -6), "beggar": ("luck", -4),
    }
    if bk in nurture:
        attr, delta = nurture[bk]
        setattr(c, attr, getattr(c, attr) + delta)

    # Clamp attributes into sane ranges.
    for attr in ("comprehension", "constitution", "soul", "luck", "charm"):
        setattr(c, attr, max(1, min(160, getattr(c, attr))))

    c.max_age = data.REALMS[0][3]
    c.recompute_max_hp()
    c.note(f"Born as {c.name}, {c.background_name}.")
    c.note(f"Spiritual root: {c.root.display}.")
    return c


def reincarnate(old: "Character", rng: Optional[random.Random] = None,
                name: Optional[str] = None) -> Character:
    """Forge a new life that carries the dim legacy of a past one (转世重生).

    The further the previous soul climbed, the stronger the echo: sharpened
    innate talent, a head start of insight, residual karma, and -- if fortune
    allows -- a single treasure smuggled across the wheel of rebirth."""
    rng = rng or random.Random()
    c = generate_character(rng, name=name)
    c.reincarnation_count = old.reincarnation_count + 1

    legacy = old.realm * 3 + len(old.daos) * 4
    c.comprehension = min(160, c.comprehension + min(45, legacy))
    c.soul = min(160, c.soul + min(35, old.realm * 2 + len(old.daos) * 2))
    c.luck = min(160, c.luck + min(20, old.realm))
    c.karma = int(old.karma * 0.3)

    # Faint memories grant a sliver of early progress.
    c.qi += c.qi_to_next * 0.5
    c.recompute_max_hp()

    note = (f"A soul reborn (rebirth #{c.reincarnation_count}), dimly recalling "
            f"a past life that reached {old.realm_name}.")
    c.note(note)

    # A truly attained soul may drag one treasure through the cycle of rebirth.
    if old.equipped_artifact and old.realm >= 4 and rng.random() < 0.4:
        c.artifacts.append(old.equipped_artifact)
        c.equipped_artifact = old.equipped_artifact
        art = data.ARTIFACT_BY_KEY[old.equipped_artifact]
        c.note(f"Across rebirth you still grasp the {art[1]} ({art[2]} grade).")
    return c
