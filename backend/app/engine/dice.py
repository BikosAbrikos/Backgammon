import random
from .state import DiceState


def roll_dice() -> DiceState:
    d1 = random.randint(1, 6)
    d2 = random.randint(1, 6)
    remaining = [d1, d1, d1, d1] if d1 == d2 else [d1, d2]
    return DiceState(values=[d1, d2], remaining=remaining)
