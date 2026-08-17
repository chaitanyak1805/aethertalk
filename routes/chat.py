from flask import Blueprint, request, jsonify, session
from routes.auth import login_required
from services.supabase_service import supabase_service
from services.groq_service import groq_service

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/api/chat", methods=["POST"])
@login_required
def send_chat_message():
    data = request.get_json() or {}
    message_content = data.get("message", "").strip()
    conversation_id = data.get("conversation_id")
    model = data.get("model")

    if not message_content:
        return jsonify({"success": False, "error": "Message content cannot be empty"}), 400

    token = session.get("access_token")
    user_id = session.get("user_id")
    
    # 1. Determine or create conversation first if not present
    new_conversation_created = False
    conversation_title = None

    if not conversation_id or conversation_id == "new":
        # Generate automatic title from first user message
        conversation_title = groq_service.generate_title(message_content)
        conv_res = supabase_service.create_conversation(token, user_id, conversation_title)
        
        if not conv_res["success"]:
            return jsonify({"success": False, "error": f"Failed to auto-create conversation: {conv_res['error']}"}), 500
        
        conversation_id = conv_res["data"]["id"]
        new_conversation_created = True
    
    # 2. Save user message to database
    user_msg_res = supabase_service.create_message(token, conversation_id, user_id, "user", message_content)
    if not user_msg_res["success"]:
        return jsonify({"success": False, "error": f"Failed to save user message: {user_msg_res['error']}"}), 500

    # 3. Retrieve chat history for context
    history_res = supabase_service.get_messages(token, conversation_id)
    if not history_res["success"]:
        return jsonify({"success": False, "error": f"Failed to retrieve chat history: {history_res['error']}"}), 500
    
    chat_messages = history_res["data"]
    
    # 4. Construct messages payload in Groq expected structure
    # Standard prefix system prompt
    groq_messages = [
        {"role": "system", "content": "You are a helpful, smart, and friendly AI chatbot assistant. Keep your responses concise, precise, and render markdown layout blocks properly."}
    ]
    
    # Pack history up to 20 messages for prompt length management
    for msg in chat_messages[-21:]:
        groq_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    # 5. Call Groq Service
    try:
        completion_content = groq_service.get_chat_response(groq_messages, model=model)
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": f"AI Engine error: {str(e)}"
        }), 502

    # 6. Save Assistant response to database
    assistant_msg_res = supabase_service.create_message(token, conversation_id, user_id, "assistant", completion_content)
    if not assistant_msg_res["success"]:
        return jsonify({"success": False, "error": f"Failed to save assistant message: {assistant_msg_res['error']}"}), 500

    # Return response payload
    return jsonify({
        "success": True,
        "conversation_id": conversation_id,
        "conversation_title": conversation_title,
        "new_conversation_created": new_conversation_created,
        "user_message": user_msg_res["data"],
        "assistant_message": assistant_msg_res["data"]
    })
