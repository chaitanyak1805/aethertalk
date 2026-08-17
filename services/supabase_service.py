import os
from supabase import create_client, Client

class SupabaseService:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.anon_key = os.getenv("SUPABASE_KEY")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.anon_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be in environment variables")
            
        # Admin client using service key for actions requiring system privileges (e.g. initial token exchanges)
        admin_key = self.service_key or self.anon_key
        self.admin_client: Client = create_client(self.url, admin_key)

    def get_user_client(self, access_token: str) -> Client:
        """
        Returns a Supabase client configured with the user's specific access token.
        This ensures all queries inherit the user's RLS policies in PostgreSQL.
        """
        # Create client options with the user's bearer token in headers
        from supabase.lib.client_options import ClientOptions
        options = ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"}
        )
        return create_client(self.url, self.anon_key, options=options)

    # Auth Methods (using admin_client or standard public client wrapper)
    def signup_user(self, email, password, full_name):
        try:
            res = self.admin_client.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "full_name": full_name
                    }
                }
            })
            return {"success": True, "user": res.user, "session": res.session}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def login_user(self, email, password):
        try:
            res = self.admin_client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            return {
                "success": True,
                "user": res.user,
                "session": {
                    "access_token": res.session.access_token,
                    "refresh_token": res.session.refresh_token,
                    "expires_at": res.session.expires_at
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def logout_user(self, access_token):
        try:
            client = self.get_user_client(access_token)
            client.auth.sign_out()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_reset_password_email(self, email, redirect_url):
        try:
            # Send reset email
            self.admin_client.auth.reset_password_for_email(email, {
                "redirect_to": redirect_url
            })
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def update_user_password(self, access_token, password):
        try:
            client = self.get_user_client(access_token)
            res = client.auth.update_user({
                "password": password
            })
            return {"success": True, "user": res.user}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Conversations Database Methods (Executing as authenticated user via user_client)
    def get_conversations(self, access_token: str):
        try:
            client = self.get_user_client(access_token)
            # Fetch, ordering by updated_at descending
            res = client.table("conversations").select("*").order("updated_at", desc=True).execute()
            return {"success": True, "data": res.data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def create_conversation(self, access_token: str, user_id: str, title: str):
        try:
            client = self.get_user_client(access_token)
            res = client.table("conversations").insert({
                "user_id": user_id,
                "title": title
            }).execute()
            return {"success": True, "data": res.data[0] if res.data else None}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def update_conversation_title(self, access_token: str, conversation_id: str, title: str):
        try:
            client = self.get_user_client(access_token)
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            res = client.table("conversations").update({
                "title": title,
                "updated_at": now
            }).eq("id", conversation_id).execute()
            return {"success": True, "data": res.data[0] if res.data else None}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def delete_conversation(self, access_token: str, conversation_id: str):
        try:
            client = self.get_user_client(access_token)
            res = client.table("conversations").delete().eq("id", conversation_id).execute()
            return {"success": True, "data": res.data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Messages Database Methods
    def get_messages(self, access_token: str, conversation_id: str):
        try:
            client = self.get_user_client(access_token)
            res = client.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
            return {"success": True, "data": res.data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def create_message(self, access_token: str, conversation_id: str, user_id: str, role: str, content: str):
        try:
            client = self.get_user_client(access_token)
            # Auto update updated_at on relevant conversation too
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            
            # Write message
            message_res = client.table("messages").insert({
                "conversation_id": conversation_id,
                "user_id": user_id,
                "role": role,
                "content": content
            }).execute()
            
            # Touch conversation
            try:
                client.table("conversations").update({"updated_at": now}).eq("id", conversation_id).execute()
            except Exception as touch_err:
                print(f"Failed to touch conversation: {touch_err}")
                
            return {"success": True, "data": message_res.data[0] if message_res.data else None}
        except Exception as e:
            return {"success": False, "error": str(e)}

# Export instanced service
supabase_service = None
try:
    supabase_service = SupabaseService()
except Exception as e:
    print(f"Supabase init warning (Normal during initialization/build without env): {e}")
