"""Constants for the Simple Timer Card companion integration."""

from enum import IntFlag, StrEnum

DOMAIN = "simple_timer_card"
STORAGE_VERSION = 1

CONF_CAPTURE_VOICE = "capture_voice_commands"
CONF_LATE_MINUTES = "late_action_minutes"
DEFAULT_CAPTURE_VOICE = True
DEFAULT_LATE_MINUTES = 10

MAX_ARCHIVED_TIMERS = 10
API_VERSION = 1

EVENT_TIMER = "simple_timer_card_timer"
WS_SUBSCRIBE = "simple_timer_card/item/subscribe"
WS_LIST = "simple_timer_card/item/list"

ATTR_TIMER_ID = "timer_id"
ATTR_DURATION = "duration"
ATTR_NAME = "name"
ATTR_COMMAND = "command"
ATTR_ACTIONS = "actions"
ATTR_ICON = "icon"
ATTR_COLOR = "color"
ATTR_METADATA = "metadata"
ATTR_STATUS = "status"
ATTR_LANGUAGE = "language"


class TimerStatus(StrEnum):
    """Status of a timer."""

    ACTIVE = "active"
    PAUSED = "paused"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class TimerEventType(StrEnum):
    """Change pushed to subscribers, matching Home Assistant timer lists."""

    CREATED = "created"
    PAUSED = "paused"
    UNPAUSED = "unpaused"
    TIME_CHANGED = "time_changed"
    FINISHED = "finished"
    CANCELLED = "cancelled"
    REMOVED = "removed"
    RESTARTED = "restarted"
    ACTION_RAN = "action_ran"


class TimerFeature(IntFlag):
    """Supported features. The first six bits match TimerListEntityFeature."""

    CREATE_TIMER = 1
    PAUSE_TIMER = 2
    CANCEL_TIMER = 4
    ADD_TIME = 8
    REMOVE_TIMER = 16
    FINISH_TIMER = 32
    RESTART_TIMER = 64
    RUN_ACTIONS = 128


ALL_FEATURES = (
    TimerFeature.CREATE_TIMER
    | TimerFeature.PAUSE_TIMER
    | TimerFeature.CANCEL_TIMER
    | TimerFeature.ADD_TIME
    | TimerFeature.REMOVE_TIMER
    | TimerFeature.FINISH_TIMER
    | TimerFeature.RESTART_TIMER
    | TimerFeature.RUN_ACTIONS
)
