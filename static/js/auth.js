// Authentication Forms Logic integration with Flask api proxies and Supabase
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const forgotForm = document.getElementById("forgot-form");
    const btnGoogle = document.getElementById("btn-google");

    // Toggle password fields visibility
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = btn.previousElementSibling;
            if (input.type === "password") {
                input.type = "text";
                btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
            } else {
                input.type = "password";
                btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
            }
        });
    });

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            setLoading(true);

            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const res = await response.json();
                if (res.success) {
                    window.location.href = "/chat";
                } else {
                    showAlert("danger", res.error || "Login credentials failed.");
                }
            } catch (err) {
                showAlert("danger", "Network error. Please try again later.");
            } finally {
                setLoading(false);
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fullName = document.getElementById("fullname").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirmPass = document.getElementById("confirm-password").value;

            if (password !== confirmPass) {
                showAlert("danger", "Passwords do not match.");
                return;
            }

            setLoading(true);

            try {
                const response = await fetch("/api/auth/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, full_name: fullName })
                });
                const res = await response.json();
                if (res.success) {
                    showAlert("success", res.message || "Signup successful! Check email for confirmation.");
                    signupForm.reset();
                } else {
                    showAlert("danger", res.error || "Could not complete registration.");
                }
            } catch (err) {
                showAlert("danger", "Network error during signup.");
            } finally {
                setLoading(false);
            }
        });
    }

    if (forgotForm) {
        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            setLoading(true);

            try {
                const response = await fetch("/api/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });
                const res = await response.json();
                if (res.success) {
                    showAlert("success", res.message || "Reset link sent. Check inbox.");
                } else {
                    showAlert("danger", res.error || "Failed to process request.");
                }
            } catch (err) {
                showAlert("danger", "Network transmission error.");
            } finally {
                setLoading(false);
            }
        });
    }

    // Google OAuth Action trigger helper
    // Standard Supabase OAuth redirects directly to the Supabase endpoint
    if (btnGoogle) {
        btnGoogle.addEventListener("click", () => {
            if (!window.SUPABASE_URL) {
                showAlert("danger", "Supabase URL is not configured. Google Sign-In is unavailable.");
                return;
            }
            const redirectUrl = window.location.origin + "/auth/callback";
            // Redirect to Supabase authorize
            window.location.href = `${window.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
        });
    }
});

function setLoading(isLoading) {
    const btn = document.getElementById("btn-submit");
    if (!btn) return;
    const label = btn.querySelector("span");
    const spinner = btn.querySelector(".btn-spinner");

    if (isLoading) {
        btn.disabled = true;
        spinner.classList.remove("hidden");
    } else {
        btn.disabled = false;
        spinner.classList.add("hidden");
    }
}

function showAlert(type, msg) {
    const container = document.getElementById("alert-container");
    if (!container) return;
    container.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fa-solid fa-circle-info"></i> ${msg}
        </div>
    `;
}
