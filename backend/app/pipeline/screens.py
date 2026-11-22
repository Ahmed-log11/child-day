"""Screen state per person. Owner: P1."""


def assign_devices(people: list[dict], objects: list[dict]) -> dict:
    """Give each phone/tablet to the person whose wrist is closest -> {track_id: [objects]}."""
    raise NotImplementedError


def tv_is_on(frame, tv_box) -> bool:
    """Brightness + change inside the TV box."""
    raise NotImplementedError


def head_direction(keypoints) -> str:
    """'toward_tv', 'down' or 'other', from nose, eyes and ears."""
    raise NotImplementedError


def screen_state(person: dict, devices: list[dict], tv: dict | None) -> str:
    """'tv', 'tablet', 'phone', 'multi_screen' or 'none'."""
    raise NotImplementedError
