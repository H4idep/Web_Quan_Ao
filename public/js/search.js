document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("headerSearchInput");
    const dropdown = document.getElementById("searchSuggestDropdown");
    const searchForm = document.getElementById("headerSearchForm");

    if (!searchInput || !dropdown) return;

    let debounceTimer = null;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();

        clearTimeout(debounceTimer);

        if (!query) {
            dropdown.classList.remove("active");
            dropdown.innerHTML = "";
            return;
        }

        dropdown.innerHTML = '<div class="suggest-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</div>';
        dropdown.classList.add("active");

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`/products/search/suggest?q=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error("Lỗi khi tìm kiếm");

                const products = await response.json();

                if (!products || products.length === 0) {
                    dropdown.innerHTML = `<div class="suggest-empty">Không tìm thấy sản phẩm cho "<strong>${escapeHtml(query)}</strong>"</div>`;
                    return;
                }

                let html = "";
                products.forEach(item => {
                    html += `
                        <a href="/products/${item.id}" class="suggest-item">
                            <img src="${item.image_url}" alt="${escapeHtml(item.name)}" />
                            <div class="suggest-info">
                                <div class="suggest-title">${escapeHtml(item.name)}</div>
                                <div class="suggest-price">${item.priceFormatted}</div>
                            </div>
                        </a>
                    `;
                });

                html += `
                    <a href="/products?q=${encodeURIComponent(query)}" class="suggest-footer">
                        Xem tất cả kết quả cho "${escapeHtml(query)}" &rarr;
                    </a>
                `;

                dropdown.innerHTML = html;
            } catch (err) {
                dropdown.innerHTML = '<div class="suggest-empty">Có lỗi xảy ra khi tìm kiếm.</div>';
            }
        }, 250);
    });

    // Ẩn dropdown khi click ra ngoài
    document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });

    // Hiện lại dropdown nếu ô tìm kiếm đang có nội dung khi focus
    searchInput.addEventListener("focus", () => {
        if (searchInput.value.trim() && dropdown.children.length > 0) {
            dropdown.classList.add("active");
        }
    });

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
