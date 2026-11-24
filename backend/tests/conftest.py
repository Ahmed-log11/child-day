"""Tests always run on mock results, even if backend/.env turns the real pipeline on."""
import os

os.environ["USE_MOCK_PIPELINE"] = "true"
