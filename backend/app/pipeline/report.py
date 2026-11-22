"""Builds the 'Session report' JSON (docs/api.md). Owner: P4."""


def build_report(session: dict, children: list[dict], segments: list[dict], events: list[dict]) -> dict:
    """Computes totals and longest still period, returns the report in the contract format."""
    raise NotImplementedError
