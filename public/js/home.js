document.addEventListener("DOMContentLoaded", () => {
    // HEADER
    const header = document.querySelector("body > header");

    if (header) {
        function updateHeader() {
            header.classList.toggle("sticky", window.scrollY > 0);
        }

        window.addEventListener("scroll", updateHeader, {
            passive: true
        });

        updateHeader();
    }

    // BANNER
    const hero = document.querySelector(".home-hero");
    const slides = document.querySelectorAll(".home-slide");
    const dots = document.querySelectorAll("[data-slide]");

    const previousButton = document.getElementById("previousSlide");
    const nextButton = document.getElementById("nextSlide");

    let currentSlide = 0;

    function showSlide(index) {
        if (!slides.length) {
            return;
        }

        currentSlide = (index + slides.length) % slides.length;

        slides.forEach((slide, position) => {
            const active = position === currentSlide;

            slide.hidden = !active;
            slide.classList.toggle("is-active", active);
        });

        dots.forEach((dot, position) => {
            const active = position === currentSlide;

            dot.classList.toggle("is-active", active);
            dot.setAttribute("aria-pressed", String(active));
        });
    }

    if (hero && slides.length) {
        previousButton.addEventListener("click", () => {
            showSlide(currentSlide - 1);
        });

        nextButton.addEventListener("click", () => {
            showSlide(currentSlide + 1);
        });

        dots.forEach(dot => {
            dot.addEventListener("click", () => {
                showSlide(Number(dot.dataset.slide));
            });
        });

        showSlide(0);
    }

    // LỌC SẢN PHẨM THEO DANH MỤC
    const categoryButtons = document.querySelectorAll("[data-category]");

    const cards = document.querySelectorAll(
        "[data-product-category]"
    );

    const productCount = document.getElementById("productCount");

    categoryButtons.forEach(button => {
        button.addEventListener("click", () => {
            const selectedCategory = button.dataset.category;
            let count = 0;

            categoryButtons.forEach(item => {
                const active = item === button;

                item.classList.toggle("is-active", active);
                item.setAttribute("aria-pressed", String(active));
            });

            cards.forEach(card => {
                const matches =
                    selectedCategory === "" ||
                    card.dataset.productCategory === selectedCategory;

                card.hidden = !matches;

                if (matches) {
                    count++;
                }
            });

            productCount.textContent = `${count} sản phẩm`;
        });
    });
});