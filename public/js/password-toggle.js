document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[type="password"]').forEach(input => {
        // Tránh tạo nút hai lần.
        if (input.closest(".password-toggle-wrap")) return;

        const wrapper = document.createElement("div");
        wrapper.className = "password-toggle-wrap";

        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "password-toggle-button";
        button.setAttribute("aria-label", "Hiện mật khẩu");
        button.setAttribute("aria-pressed", "false");
        button.title = "Hiện mật khẩu";

        if (input.id) {
            button.setAttribute("aria-controls", input.id);
        }

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-eye";
        icon.setAttribute("aria-hidden", "true");

        button.appendChild(icon);
        wrapper.appendChild(button);

        button.addEventListener("click", () => {
            const showPassword = input.type === "password";

            input.type = showPassword ? "text" : "password";

            const label = showPassword
                ? "Ẩn mật khẩu"
                : "Hiện mật khẩu";

            button.setAttribute("aria-label", label);
            button.setAttribute("aria-pressed", String(showPassword));
            button.title = label;

            icon.className = showPassword
                ? "fa-solid fa-eye-slash"
                : "fa-solid fa-eye";
        });
    });
});