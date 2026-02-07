import os

from flask import Flask, send_from_directory

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.getcwd())
RENDER_FILE = "render/index.html"


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    full_path = os.path.join(BASE_DIR, path)

    if os.path.isfile(full_path):
        return send_from_directory(BASE_DIR, path)

    return send_from_directory(BASE_DIR, RENDER_FILE)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
