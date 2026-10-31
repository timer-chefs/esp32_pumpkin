"""Turns environment variables into compile-time defines.

Lets one machine differ from the repo's defaults without a change that gets
committed. Each variable is always defined, to its environment value or else
its default below, so the code can use it without a fallback of its own.

    LED_COLOR_ORDER=GRB pio run -e application
"""

import os
from enum import Enum

Import("env")


class DefaultEnv(Enum):
    """Each member is an environment variable, and its value is the default."""

    LED_COLOR_ORDER = "RGB"


for default in DefaultEnv:
    value = os.environ.get(default.name) or default.value
    origin = (
        "default" if value == default.value else "overridden by environment variable"
    )
    print(f"{default.name}={value} ({origin})")

    env.Append(CPPDEFINES=[(default.name, value)])
