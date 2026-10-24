document.querySelectorAll("form[data-confirm]").forEach(form => {
    form.addEventListener("submit", event => {
        if (!window.confirm(form.dataset.confirm)) {
            event.preventDefault();
        }
    });
});

const imageFile = document.getElementById("imageFile");

if (imageFile) {
    const form = document.getElementById("adminEditForm");
    const imageUrl = document.getElementById("image_url");
    const imagePreview = document.getElementById("imagePreview");
    const imageEmpty = document.getElementById("imageEmpty");
    const uploadStatus = document.getElementById("uploadStatus");
    const saveButton = document.getElementById("saveButton");

    let uploading = false;
    let uploadFailed = false;

    function updatePreview() {
        const value = imageUrl.value.trim();
        let allowed = /^\/(?:uploads\/products|images|img)\//.test(value);

        try {
            if (value) {
                allowed ||= new URL(value).protocol === "https:";
            }
        } catch {
            // Đường dẫn nội bộ đã được kiểm tra phía trên.
        }

        imagePreview.hidden = !value || !allowed;
        imageEmpty.hidden = Boolean(value && allowed);

        if (value && allowed) {
            imagePreview.src = value;
        } else {
            imagePreview.removeAttribute("src");
        }
    }

    imageUrl.addEventListener("input", () => {
        uploadFailed = false;
        updatePreview();
    });

    imagePreview.addEventListener("error", () => {
        imagePreview.hidden = true;
        imageEmpty.hidden = false;
        imageEmpty.textContent = "Không tải được ảnh";
    });

    form.addEventListener("submit", event => {
        if (uploading || uploadFailed) {
            event.preventDefault();

            uploadStatus.textContent = uploading
                ? "Đợi tải ảnh xong rồi lưu."
                : "Ảnh tải lên chưa thành công. Chọn lại ảnh hoặc nhập đường dẫn.";
        }
    });

    imageFile.addEventListener("change", async () => {
        const file = imageFile.files[0];

        if (!file) {
            return;
        }

        uploadFailed = false;

        if (file.size > 3 * 1024 * 1024) {
            uploadFailed = true;
            uploadStatus.textContent = "Ảnh không được vượt quá 3 MB.";
            imageFile.value = "";
            return;
        }

        const data = new FormData();
        data.append("image", file);

        uploading = true;
        const originallyDisabled = saveButton.disabled;

        saveButton.disabled = true;
        imageFile.disabled = true;
        imageUrl.disabled = true;
        uploadStatus.textContent = "Đang tải ảnh...";

        try {
            const response = await fetch("/admin/upload-image", {
                method: "POST",
                headers: {
                    "X-CSRF-Token": form.elements._csrf.value
                },
                body: data
            });

            const isJson = response.headers
                .get("content-type")
                ?.includes("application/json");

            if (!isJson) {
                throw new Error(
                    "Phiên đăng nhập hết hạn hoặc server gặp lỗi. Hãy tải lại trang."
                );
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Không tải được ảnh.");
            }

            imageUrl.value = result.image_url;
            imageEmpty.textContent = "Chưa có ảnh";

            updatePreview();

            uploadStatus.textContent = "Đã tải ảnh. Nhấn lưu để lưu sản phẩm.";
        } catch (error) {
            uploadFailed = true;
            uploadStatus.textContent = error.message;
        } finally {
            uploading = false;
            saveButton.disabled = originallyDisabled;
            imageFile.disabled = false;
            imageUrl.disabled = false;
            imageFile.value = "";
        }
    });
}