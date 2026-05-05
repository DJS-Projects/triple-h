"""LLM provider abstraction layer.

Provider config lives as data in `providers.py`. `client.get_model()`
dispatches on `kind` to construct the right Pydantic AI model.
"""
