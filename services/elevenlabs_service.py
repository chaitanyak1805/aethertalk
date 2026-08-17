import os
import requests

class ElevenLabsService:
    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") # Default Rachel voice
        if not self.api_key:
            print("Warning: ELEVENLABS_API_KEY not found in environment variables")

    def text_to_speech(self, text: str) -> bytes:
        """
        Sends text to ElevenLabs TTS model API and returns audio stream bytes.
        """
        if not self.api_key:
            raise ValueError("ElevenLabs API Key is not configured in .env")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        data = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        try:
            response = requests.post(url, json=data, headers=headers, stream=True)
            if response.status_code != 200:
                error_msg = response.text
                print(f"ElevenLabs API error: {response.status_code} - {error_msg}")
                raise RuntimeError(f"ElevenLabs TTS failed: {error_msg}")
            
            return response.content
        except Exception as e:
            print(f"ElevenLabs transaction error: {e}")
            raise

    def speech_to_text(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """
        Sends audio to ElevenLabs Scribe STT model API and returns transcribed text.
        """
        if not self.api_key:
            raise ValueError("ElevenLabs API Key is not configured in .env")

        url = "https://api.elevenlabs.io/v1/speech-to-text"
        headers = {
            "xi-api-key": self.api_key
        }
        data = {
            "model_id": "scribe_v2"
        }
        files = {
            "file": (filename, audio_bytes, "audio/mpeg")
        }
        
        try:
            response = requests.post(url, data=data, files=files, headers=headers)
            if response.status_code != 200:
                error_msg = response.text
                print(f"ElevenLabs STT API error: {response.status_code} - {error_msg}")
                raise RuntimeError(f"ElevenLabs STT failed: {error_msg}")
            
            return response.json().get("text", "")
        except Exception as e:
            print(f"ElevenLabs STT error: {e}")
            raise

# Export instanced service
elevenlabs_service = None
try:
    elevenlabs_service = ElevenLabsService()
except Exception as e:
    print(f"ElevenLabs Service init warning: {e}")
