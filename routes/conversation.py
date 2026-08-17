from flask import Blueprint, request, jsonify, session
from routes.auth import login_required
from services.supabase_service import supabase_service

conversation_bp = Blueprint("conversation", __name__)

@conversation_bp.route("/api/conversations", methods=["GET"])
@login_required
def get_conversations():
    token = session.get("access_token")
    res = supabase_service.get_conversations(token)
    if res["success"]:
        return jsonify({"success": True, "conversations": res["data"]})
    return jsonify({"success": False, "error": res["error"]}), 400

@conversation_bp.route("/api/conversations", methods=["POST"])
@login_required
def create_conversation():
    data = request.get_json() or {}
    title = data.get("title", "New Chat")
    token = session.get("access_token")
    user_id = session.get("user_id")
    
    res = supabase_service.create_conversation(token, user_id, title)
    if res["success"]:
        return jsonify({"success": True, "conversation": res["data"]})
    return jsonify({"success": False, "error": res["error"]}), 400

@conversation_bp.route("/api/conversations/<conversation_id>/messages", methods=["GET"])
@login_required
def get_conversation_messages(conversation_id):
    token = session.get("access_token")
    res = supabase_service.get_messages(token, conversation_id)
    if res["success"]:
        return jsonify({"success": True, "messages": res["data"]})
    return jsonify({"success": False, "error": res["error"]}), 400

@conversation_bp.route("/api/conversations/<conversation_id>", methods=["PATCH"])
@login_required
def rename_conversation(conversation_id):
    data = request.get_json() or {}
    title = data.get("title")
    if not title:
        return jsonify({"success": False, "error": "Title is required"}), 400
        
    token = session.get("access_token")
    res = supabase_service.update_conversation_title(token, conversation_id, title)
    if res["success"]:
        return jsonify({"success": True, "conversation": res["data"]})
    return jsonify({"success": False, "error": res["error"]}), 400

@conversation_bp.route("/api/conversations/<conversation_id>", methods=["DELETE"])
@login_required
def delete_conversation(conversation_id):
    token = session.get("access_token")
    res = supabase_service.delete_conversation(token, conversation_id)
    if res["success"]:
        return jsonify({"success": True, "message": "Conversation deleted successfully."})
    return jsonify({"success": False, "error": res["error"]}), 400
