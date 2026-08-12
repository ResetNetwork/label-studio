from core.utils.static_serve import static_file_cache_control


def test_react_bundle_is_revalidated():
    assert static_file_cache_control('main.css', 'react-app') == 'no-cache'
    assert static_file_cache_control('167.css', 'react-app') == 'no-cache'


def test_hashed_static_asset_remains_immutable():
    immutable = 'public, max-age=31536000, immutable'

    assert static_file_cache_control('167.e3d3bc638670f337.css', 'react-app') == immutable
    assert static_file_cache_control('main.abc12345.css') == immutable
