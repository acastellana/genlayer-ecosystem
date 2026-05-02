def pytest_ignore_collect(collection_path, config):
    """Keep direct-mode GenLayer tests under gltest, not vanilla pytest.

    The normal `pytest -q` suite covers static/unit checks. Direct contract tests
    need gltest's VM fixtures and are run with `gltest tests/direct/ -q`.
    """
    if config.pluginmanager.hasplugin("gltest_direct"):
        return False
    return True
