import os
from groq import Groq

# Model configurations
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b" # openai/gpt-oss-120b is stable and versatile

class GroqService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            print("Warning: GROQ_API_KEY not found in environment variables")
        self.client = Groq(api_key=self.api_key) if self.api_key else None

    def get_chat_response(self, messages, model=None):
        """
        Sends conversation history to Groq API and returns completion response.
        :param messages: List of dicts, format: [{"role": "user"/"assistant", "content": "text"}]
        :param model: The Groq model name
        """
        if not self.client:
            # Fallback if Groq key isn't provided (for easy developer signup workflow)
            return "Groq API key is not configured. Please supply a valid GROQ_API_KEY in your .env file."
        
        if not model:
            model = DEFAULT_GROQ_MODEL
            
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                top_p=1.0,
                stream=False
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Groq API error: {e}")
            raise RuntimeError(f"Failed to communicate with Groq AI service: {str(e)}")

    def generate_title(self, first_message: str) -> str:
        """
        Generates a concise 2-5 word title based on the first message.
        """
        if not self.client:
            # If no API key, return a truncated message title hook
            words = first_message.split()
            return " ".join(words[:4]) + ("..." if len(words) > 4 else "")
            
        prompt = (
            "Generate a concise, user-friendly 2 to 5 words title for a chat conversation "
            "based matches the first message below. Return ONLY the high level title text itself. "
            "Do not wrap inside quotes, do not append any explanations, and do not introduce "
            "preambles like 'Title:'.\n\n"
            f"First Message: {first_message}"
        )
        try:
            response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant", # Use a smaller, faster model for title generation
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=30,
                stream=False
            )
            title = response.choices[0].message.content.strip()
            # Clean up and normalize
            title = title.strip('"\'')
            if title.lower().startswith("title:"):
                title = title[6:].strip()
            return title
        except Exception as e:
            print(f"Groq title generation warning: {e}")
            words = first_message.split()
            return " ".join(words[:4]) + ("..." if len(words) > 4 else "")

# Export instanced service
groq_service = None
try:
    groq_service = GroqService()
except Exception as e:
    print(f"Groq Service init warning: {e}")
