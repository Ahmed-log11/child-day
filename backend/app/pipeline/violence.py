"""Violent contact classifier (trained in training/02_violence_classifier.ipynb). Owner: P2."""


def load_model(weights_path: str):
    """Load the trained MobileNetV2 + LSTM model."""
    raise NotImplementedError


def violent_contact_score(model, clip_frames: list) -> float:
    """Probability (0-1) that a 2-3 second clip shows violent contact.

    Only called when two people are close together.
    """
    raise NotImplementedError
