# AetherTalk: Secure AI Chatbot Web Application

AetherTalk is a modular, secure, and fully responsive conversational assistant. It leverages Flask on the backend, vanilla HTML5, CSS3, and JavaScript on the frontend, and interfaces with Supabase (Auth and DB), Groq, and ElevenLabs API services.

## Architecture & Design

### Folder Structure
* `app.py`: Entrypoint initializing the Flask environment and registering blueprint modules.
* `routes/`: Backend controller blueprints:
  * `auth.py`: Handles views and endpoints for signup, email credential logins, forgot password requests, and Supabase OAuth session bindings.
  * `chat.py`: Directs user messages, compiles session message context, and executes Groq API prompts.
  * `voice.py`: Passes text outputs to the ElevenLabs synthesis pipeline and serves audio streams.
  * `conversation.py`: Coordinates CRUD actions on user conversational items.
* `services/`: Low-level API abstractions:
  * `supabase_service.py`: Standardizes database insertions and session bindings.
  * `groq_service.py`: Interfaces with the low-latency Llama inference models.
  * `elevenlabs_service.py`: Handles TTS speech generation requests.
* `templates/`: HTML5 views using Outfit typography and FontAwesome components.
* `static/css/`: Vanilla styles:
  * `style.css`: Contains CSS resets, core landing layouts, and global grid setups.
  * `themes.css`: Holds color variables for Light, Dark, Ocean, and Purple styles.
  * `login.css`/`chat.css`: Card structures and chat messaging panes.
* `static/js/`: Vanilla JS scripts:
  * `theme.js`: Switcher script persisting styles locally.
  * `auth.js`: Handles validation and form callbacks.
  * `conversation.js`/`chat.js`: Operations managing state lists and Markdown renders.
  * `voice.js`: Speech Web recognition APIs.
* `database/`: Database blueprints containing schema files and Postgres policies.

---

## Technical Configuration

### Environment Setup
Create a `.env` file in the root directory based on the `.env.example` template:
* `FLASK_SECRET_KEY`: Cryptographic signing block for session cookies.
* `FLASK_DEBUG`: Flag togglers (e.g. `True` / `False`).
* `SUPABASE_URL`: Domain host URL for your project instance.
* `SUPABASE_KEY`: Anon public token for executing RLS-guarded functions.
* `SUPABASE_SERVICE_ROLE_KEY`: Service-level token used for initial OAuth PKCE handshakes.
* `GROQ_API_KEY`: API access token.
* `ELEVENLABS_API_KEY`: Speech synthesis token.
* `ELEVENLABS_VOICE_ID`: Target voice identity hash.

---

## Authentication & Session Flow

AetherTalk uses a hybrid authentication mechanism:
1. **Credentials Login**: Verified via the Supabase Auth API backend, which returns user profiles and access tokens.
2. **OAuth (Google)**: Users seeking Google Auth are redirected to the Supabase OAuth provider endpoint from the client. Feedback is handled via:
   * **PKCE Flow**: The backend exchanges the returned auth code for a session token.
   * **Implicit Flow**: Browser JavaScript parses the redirect hash, POSTs details to the session sync API (`/api/auth/session-sync`), and synchronizes the Cookies session.
3. **Protected Routes**: Protected endpoints check Flask's session object for an active, authentic access token before executing.

---

## Database Management & Security

### Rows-Level Security (RLS)
Security is handled at the database level using PostgreSQL Row Level Security:
* **Profiles**: Handled automatically. When a user creates an account, a trigger function duplicates their basic details to the `profiles` table. Users can read/edit only their own profile row.
* **Conversations**: Users can only query, insert, rename, or delete conversation groups matching their account ID (`auth.uid()`).
* **Messages**: Message reads/inserts verify matches against the target conversation's user owner ID.

### Schema Blueprint (schema.sql)
1. **profiles**: References the default `auth.users(id)` column.
2. **conversations**: Contains conversation keys.
3. **messages**: Contains dialog threads (user, assistant, system).

---

## Core Services Details

### Groq AI Integrations
Sends context history to the Groq API. System instructions establish the assistant profile rules. Automatically creates short conversational titles from the first message if none are supplied.

### ElevenLabs Text-to-Speech
Sends message text payloads to the text-to-speech engine and returns synthesized audio streams. The client UI receives the binary response and streams playback through a sound object.

### Speech-to-Text Voice Inputs
Uses browser Web Speech Recognition APIs to transcribe voices into input text fields. Cleans text output states automatically before auto-submitting messages.
