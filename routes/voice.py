from flask import Blueprint, request, Response, session, jsonify
from routes.auth import login_required
from services.elevenlabs_service import elevenlabs_service

voice_bp = Blueprint("voice", __name__)

@voice_bp.route("/api/voice/tts", methods=["POST"])
@login_required
def text_to_speech():
    data = request.get_json() or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"success": False, "error": "Text payload is empty"}), 400

    try:
        audio_data = elevenlabs_service.text_to_speech(text)
        return Response(audio_data, mimetype="audio/mpeg")
    except ValueError as val_err:
        return jsonify({"success": False, "error": str(val_err)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"TTS synthesis failed: {str(e)}"}), 500

@voice_bp.route("/api/voice/stt", methods=["POST"])
@login_required
def speech_to_text_endpoint():
    if "audio" not in request.files:
        return jsonify({"success": False, "error": "No audio file provided"}), 400
    
    audio_file = request.files["audio"]
    if audio_file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400
        
    try:
        audio_bytes = audio_file.read()
        text = elevenlabs_service.speech_to_text(audio_bytes, audio_file.filename)
        return jsonify({"success": True, "text": text})
    except Exception as e:
        return jsonify({"success": False, "error": f"STT transcribing failed: {str(e)}"}), 500
