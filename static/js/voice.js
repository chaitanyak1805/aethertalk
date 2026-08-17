// Text-to-Speech & Speech-to-Text Voice controller operations

window.isVoiceSpeaking = false;
window.isVoiceListening = false;
let currentAudioNode = null;
let mediaRecorderObj = null;
let audioChunks = [];
let localMediaStream = null;

document.addEventListener("DOMContentLoaded", () => {
    const voiceInputBtn = document.getElementById("voice-input-btn");
    const voiceOverlayStop = document.getElementById("voice-overlay-stop");

    if (voiceInputBtn) {
        voiceInputBtn.addEventListener("click", () => {
            triggerMicrophoneCapture();
        });
    }

    if (voiceOverlayStop) {
        voiceOverlayStop.addEventListener("click", () => {
            haltVoicePipeline();
        });
    }
});

async function triggerSpeechSynthesizer(text, buttonNode) {
    if (window.isVoiceSpeaking) {
        haltVoicePipeline();
        return;
    }

    window.isVoiceSpeaking = true;
    const originalHtml = buttonNode.innerHTML;
    buttonNode.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing...';
    buttonNode.disabled = true;

    try {
        const response = await fetch("/api/voice/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "TTS synthesis server error");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        currentAudioNode = new Audio(audioUrl);

        currentAudioNode.onstart = () => {
            buttonNode.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Stop';
            buttonNode.disabled = false;
        };

        currentAudioNode.onplay = () => {
            buttonNode.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Stop';
            buttonNode.disabled = false;
        };

        currentAudioNode.onended = () => {
            buttonNode.innerHTML = originalHtml;
            window.isVoiceSpeaking = false;
            currentAudioNode = null;
        };

        // Play the speech audio
        await currentAudioNode.play();

    } catch (e) {
        console.error("Speech synthesization error: ", e);
        alert("Text-to-speech option failed: " + e.message);
        buttonNode.innerHTML = originalHtml;
        buttonNode.disabled = false;
        window.isVoiceSpeaking = false;
    }
}

async function triggerMicrophoneCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support Audio Recording.");
        return;
    }

    // Stop audio speech output if currently playing
    haltVoicePipeline();

    try {
        localMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderObj = new MediaRecorder(localMediaStream);
        audioChunks = [];

        mediaRecorderObj.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorderObj.onstop = async () => {
            window.isVoiceListening = false;

            // Generate Blob 
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];

            // Release microphone
            if (localMediaStream) {
                localMediaStream.getTracks().forEach(track => track.stop());
                localMediaStream = null;
            }

            // Hide overlay UI but show processing state
            toggleVoiceOverlayUI("Processing...", "Converting speech to text via ElevenLabs...", false);

            // Send to Backend
            try {
                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.webm");

                const response = await fetch("/api/voice/stt", {
                    method: "POST",
                    body: formData
                });

                const data = await response.json();
                if (data.success && data.text) {
                    const inputField = document.getElementById("message-input");
                    if (inputField) {
                        inputField.value = data.text;
                        inputField.dispatchEvent(new Event("input"));

                        // Auto trigger send!
                        const chatForm = document.getElementById("chat-form");
                        if (chatForm) {
                            chatForm.dispatchEvent(new Event("submit"));
                        }
                    }
                } else {
                    console.error("STT Error:", data.error);
                    alert("Speech-to-text failed: " + (data.error || "Unknown error"));
                }
            } catch (err) {
                console.error("Speech submission failed:", err);
                alert("Failed to submit audio for transcription.");
            } finally {
                cleanupVoiceOverlay();
            }
        };

        mediaRecorderObj.start();
        window.isVoiceListening = true;
        toggleVoiceOverlayUI("Listening...", "I am listening for your voice message. Click Stop when done.");

    } catch (err) {
        console.error("Failed to start speech recording: ", err);
        alert("Could not access microphone.");
    }
}

function haltVoicePipeline() {
    // Stop synthesizers
    if (currentAudioNode) {
        currentAudioNode.pause();
        currentAudioNode = null;
    }
    window.isVoiceSpeaking = false;

    // Stop recording listen tools
    if (mediaRecorderObj && window.isVoiceListening) {
        mediaRecorderObj.stop();
    }
    window.isVoiceListening = false;

    // Reset all volume play buttons inside chat bubbles to default copy icons
    document.querySelectorAll(".voice-bubble-btn").forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
    });

    cleanupVoiceOverlay();
}

function toggleVoiceOverlayUI(title, subtitle, isError = false) {
    const overlay = document.getElementById("voice-overlay");
    const visualizer = document.getElementById("wave-visualizer");
    if (!overlay) return;

    overlay.classList.remove("hidden");
    document.getElementById("voice-status-title").innerText = title;
    document.getElementById("voice-status-sub").innerText = subtitle;

    if (isError) {
        visualizer.classList.add("hidden");
    } else {
        visualizer.classList.remove("hidden");
    }
}

function cleanupVoiceOverlay() {
    const overlay = document.getElementById("voice-overlay");
    if (overlay) {
        overlay.classList.add("hidden");
    }
}

window.triggerSpeechSynthesizer = triggerSpeechSynthesizer;
window.haltVoicePipeline = haltVoicePipeline;
