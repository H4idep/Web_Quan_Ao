document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("loginPassword");
    const button = document.getElementById("loginPasswordToggle");

    if (!input || !button) return;

    button.addEventListener("click", () => {
        const visible = input.type === "password";

        input.type = visible ? "text" : "password";

        const label = visible ? "Ẩn mật khẩu" : "Hiện mật khẩu";

        button.setAttribute("aria-label", label);
        button.title = label;

        button.querySelector("i").className = visible
            ? "fa-solid fa-eye-slash"
            : "fa-solid fa-eye";
    });
});