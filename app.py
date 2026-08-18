import os
from flask import Flask, render_template, redirect, url_for, session
from dotenv import load_dotenv

# Load all environment variables
load_dotenv()

# Build app
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev_secret_key_antigravity_1x2y3z")

# Register Blueprints
from routes.auth import auth_bp, login_required
from routes.chat import chat_bp
from routes.conversation import conversation_bp
from routes.voice import voice_bp

app.register_blueprint(auth_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(conversation_bp)
app.register_blueprint(voice_bp)

@app.route("/")
def index_view():
    """Landing homepage."""
    if session.get("access_token"):
        return redirect(url_for("chat_view"))
    return render_template("index.html")

@app.route("/chat")
@login_required
def chat_view():
    """Main protected chat interface."""
    user_email = session.get("user_email")
    user_name = session.get("user_name", "")
    return render_template("chat.html", user_email=user_email, user_name=user_name)

# Context processor to inject variables into templates
@app.context_processor
def inject_user():
    return {
        "logged_in": "access_token" in session,
        "user_email": session.get("user_email"),
        "user_name": session.get("user_name"),
        "env_supabase_url": os.getenv("SUPABASE_URL", ""),
        "env_supabase_key": os.getenv("SUPABASE_KEY", "")
    }

# General Error Handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template("index.html", error_message="Page not found"), 404

@app.errorhandler(500)
def server_error(e):
    return render_template("index.html", error_message="An internal server error occurred"), 500

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    # Bound to standard localhost port 5000
    app.run(host="0.0.0.0", port=5000)
