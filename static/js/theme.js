// Theme switcher logic
document.addEventListener("DOMContentLoaded", () => {
    const themeSelect = document.getElementById("theme-select");
    const savedTheme = localStorage.getItem("aether-theme") || "theme-dark";

    // Set initial theme
    document.body.className = "";
    document.body.classList.add(savedTheme);

    // Update dropdown index if present
    if (themeSelect) {
        themeSelect.value = savedTheme;
        themeSelect.addEventListener("change", (e) => {
            const nextTheme = e.target.value;
            setAppTheme(nextTheme);
        });
    }
});

function setAppTheme(themeName) {
    document.body.className = "";
    document.body.classList.add(themeName);
    localStorage.setItem("aether-theme", themeName);
}
