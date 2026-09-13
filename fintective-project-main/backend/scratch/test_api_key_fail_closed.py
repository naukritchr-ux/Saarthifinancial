import os
import subprocess
import sys

def test_production_missing_api_key_raises_runtime_error():
    """
    Asserts that attempting to import/run backend/app.py in production
    without an API_KEY raises RuntimeError and refuses to start.
    """
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    # Environment with FLASK_ENV=production, ENFORCE_API_KEY=true, but EMPTY API_KEY
    env = os.environ.copy()
    env['FLASK_ENV'] = 'production'
    env['ENFORCE_API_KEY'] = 'true'
    env['API_KEY'] = ''

    # Execute Python one-liner to import app
    code = "import app"
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True
    )

    # Must exit with non-zero code due to RuntimeError
    assert proc.returncode != 0, f"Expected non-zero exit code, but process exited with 0.\nStdout: {proc.stdout}\nStderr: {proc.stderr}"
    assert "RuntimeError: CRITICAL SECURITY CONFIGURATION: API_KEY environment variable must be set in production." in proc.stderr, (
        f"Expected RuntimeError about missing API_KEY in production, but got:\n{proc.stderr}"
    )
    print("PASS: Production without API_KEY correctly fails-closed with RuntimeError.")


def test_production_with_valid_api_key_passes():
    """
    Asserts that providing a valid API_KEY in production allows app to initialize without RuntimeError.
    """
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    env = os.environ.copy()
    env['FLASK_ENV'] = 'production'
    env['ENFORCE_API_KEY'] = 'true'
    env['API_KEY'] = 'test-prod-key-12345'

    code = "import app; print('APP_INIT_SUCCESS')"
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True
    )

    assert "APP_INIT_SUCCESS" in proc.stdout, f"Failed to initialize with valid API_KEY.\nStdout: {proc.stdout}\nStderr: {proc.stderr}"
    print("PASS: Production with API_KEY config initializes successfully.")


if __name__ == '__main__':
    print("Running API Key Fail-Closed Regression Guard...")
    test_production_missing_api_key_raises_runtime_error()
    test_production_with_valid_api_key_passes()
    print("ALL REGRESSION GUARDS PASSED SUCCESSFULLY!")
