from flask import Blueprint, render_template, redirect, url_for, request, session, jsonify, flash
from functools import wraps
from services.supabase_service import supabase_service

auth_bp = Blueprint("auth", __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("access_token") or not session.get("user_id"):
            if request.path.startswith("/api/") or request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({"error": "Unauthorized session"}), 401
            return redirect(url_for("auth.login_view"))
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route("/login", methods=["GET"])
def login_view():
    if session.get("access_token") and session.get("user_id"):
        return redirect(url_for("chat_view"))
    # Clear any broken/partial session to stop redirect loops
    session.clear()
    return render_template("login.html")

@auth_bp.route("/signup", methods=["GET"])
def signup_view():
    if session.get("access_token") and session.get("user_id"):
        return redirect(url_for("chat_view"))
    return render_template("signup.html")

@auth_bp.route("/forgot-password", methods=["GET"])
def forgot_password_view():
    return render_template("forgot_password.html")

# Auth Actions
@auth_bp.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name")

    if not email or not password or not full_name:
        return jsonify({"success": False, "error": "All fields are required"}), 400

    res = supabase_service.signup_user(email, password, full_name)
    if res["success"]:
        return jsonify({"success": True, "message": "Sign up successful! Please check your email for confirmation."})
    return jsonify({"success": False, "error": res["error"]}), 400

@auth_bp.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400

    res = supabase_service.login_user(email, password)
    if res["success"]:
        # Put session details in flask session
        session["access_token"] = res["session"]["access_token"]
        session["refresh_token"] = res["session"]["refresh_token"]
        session["user_id"] = res["user"].id
        session["user_email"] = res["user"].email
        session["user_name"] = res["user"].user_metadata.get("full_name", "")
        return jsonify({"success": True})
    return jsonify({"success": False, "error": res["error"]}), 400

@auth_bp.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    token = session.get("access_token")
    if token:
        supabase_service.logout_user(token)
    session.clear()
    return jsonify({"success": True})

@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
def auth_forgot_password():
    data = request.get_json() or {}
    email = data.get("email")
    if not email:
        return jsonify({"success": False, "error": "Email is required"}), 400
    
    # Generate direct home redirect url for password reset callback target
    redirect_url = request.url_root.rstrip("/") + "/auth/callback?type=recovery"
    res = supabase_service.send_reset_password_email(email, redirect_url)
    if res["success"]:
        return jsonify({"success": True, "message": "Check your email for password reset instructions."})
    return jsonify({"success": False, "error": res["error"]}), 400

@auth_bp.route("/api/auth/reset-password", methods=["POST"])
@login_required
def auth_reset_password():
    data = request.get_json() or {}
    password = data.get("password")
    
    if not password:
        return jsonify({"success": False, "error": "New password is required"}), 400
        
    token = session.get("access_token")
    res = supabase_service.update_user_password(token, password)
    if res["success"]:
        return jsonify({"success": True, "message": "Password updated successfully!"})
    return jsonify({"success": False, "error": res["error"]}), 400

# OAuth callback & Session Synchronization Flow
@auth_bp.route("/auth/callback", methods=["GET"])
def auth_callback():
    code = request.args.get("code")
    err_description = request.args.get("error_description") or request.args.get("error")
    
    if err_description:
        flash(f"OAuth Authentication Error: {err_description}", "danger")
        return redirect(url_for("auth.login_view"))

    if code:
        # User is coming from PKCE OAuth context (Google or other auth redirect)
        try:
            res = supabase_service.admin_client.auth.exchange_code_for_session(code)
            session["access_token"] = res.session.access_token
            session["refresh_token"] = res.session.refresh_token
            session["user_id"] = res.user.id
            session["user_email"] = res.user.email
            session["user_name"] = res.user.user_metadata.get("full_name", res.user.user_metadata.get("name", ""))
            return redirect(url_for("chat_view"))
        except Exception as e:
            flash(f"Configuration or exchange error: {str(e)}", "danger")
            return redirect(url_for("auth.login_view"))

    # If it is implicit flow, standard hash fragments containing access_token will be resolved inside browser JS
    return render_template("callback.html")

@auth_bp.route("/api/auth/session-sync", methods=["POST"])
def auth_session_sync():
    """
    Endpoint for Javascript to exchange OAuth client credentials (implicit flow hashes)
    and synchronize it with the Flask server session.
    """
    data = request.get_json() or {}
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    
    if not access_token:
        return jsonify({"success": False, "error": "Access token not provided"}), 400
        
    try:
        # Validate token directly via admin client using jwt param
        res = supabase_service.admin_client.auth.get_user(jwt=access_token)
        
        if not res or not res.user:
            return jsonify({"success": False, "error": "Invalid or expired token — user not found"}), 401
        
        session["access_token"] = access_token
        session["refresh_token"] = refresh_token
        session["user_id"] = res.user.id
        session["user_email"] = res.user.email
        session["user_name"] = res.user.user_metadata.get("full_name", res.user.user_metadata.get("name", ""))
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to synchronize session: {str(e)}"}), 401
