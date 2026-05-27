from firebase_functions import https_fn
from machin_scraper import app

# Expose the FastAPI app as a Gen 2 HTTPS Cloud Function named 'api'
# The firebase-functions Python SDK automatically wraps and routes
# requests to standard ASGI applications (like FastAPI) directly.
api = https_fn.on_request(app)
