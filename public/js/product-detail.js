(() => {
  const variantsData = document.getElementById("productVariantsData");

  if (variantsData) {
    const variants = JSON.parse(variantsData.textContent || "[]");
    const form = document.getElementById("addToCartForm");
    const variantIdInput = document.getElementById("selectedVariantId");
    const colorButtons = [...document.querySelectorAll(".btn-color")];
    const sizeButtons = [...document.querySelectorAll(".btn-size")];
    const selectedColorText = document.getElementById("selectedColorText");
    const selectedSizeText = document.getElementById("selectedSizeText");
    const stockNotice = document.getElementById("variantStockNotice");
    const stockStatus = document.getElementById("pd-stock-status");
    const stockText = document.getElementById("pd-stock-text");
    const quantityInput = document.getElementById("pd-quantity");
    const addButton = document.getElementById("btnAddToCart");
    const productStock = Number(stockStatus?.dataset.stock || 0);
    let selectedColor = "";
    let selectedSize = "";

    function setStockStatus(stock) {
      if (!stockStatus || !stockText) return;
      const available = stock > 0;
      stockStatus.classList.toggle("is-sold-out", !available);
      stockText.textContent = available
        ? `Còn ${stock} sản phẩm`
        : "Tạm hết hàng";
    }

    function resetQuantity(stock = 99, disabled = false) {
      const max = Math.min(stock, 99);
      quantityInput.max = String(Math.max(max, 1));
      quantityInput.disabled = disabled;
      if (max > 0 && Number(quantityInput.value) > max) {
        quantityInput.value = String(max);
      }
    }

    function updateSizeOptions() {
      const availableSizes = new Set(
        variants
          .filter(variant => variant.color === selectedColor)
          .map(variant => variant.size)
      );

      sizeButtons.forEach(button => {
        const available = availableSizes.has(button.dataset.size);
        button.hidden = !available;
        if (!available) {
          button.classList.remove("active");
          button.setAttribute("aria-pressed", "false");
        }
      });
    }

    function updateSelectedVariant() {
      const variant = variants.find(item =>
        item.color === selectedColor && item.size === selectedSize
      );

      if (!variant) {
        variantIdInput.value = "";
        addButton.disabled = true;
        stockNotice.textContent = selectedColor
          ? "Vui lòng chọn size có sẵn cho màu này."
          : "Vui lòng chọn màu sắc và kích cỡ.";
        stockNotice.classList.remove("is-available");
        setStockStatus(productStock);
        resetQuantity(99);
        return;
      }

      const stock = Number(variant.stock);
      variantIdInput.value = String(variant.id);
      addButton.disabled = stock <= 0;
      stockNotice.textContent = stock > 0
        ? `Còn ${stock} sản phẩm trong kho.`
        : "Phân loại này hiện đã hết hàng.";
      stockNotice.classList.toggle("is-available", stock > 0);
      setStockStatus(stock);
      resetQuantity(stock, stock <= 0);
    }

    if (variants.length > 0) {
      addButton.disabled = true;
      stockNotice.textContent = "Vui lòng chọn màu sắc và kích cỡ.";
      setStockStatus(productStock);
      resetQuantity(99);

      colorButtons.forEach(button => {
        button.addEventListener("click", () => {
          colorButtons.forEach(colorButton => {
            const selected = colorButton === button;
            colorButton.classList.toggle("active", selected);
            colorButton.setAttribute("aria-pressed", String(selected));
          });
          selectedColor = button.dataset.color;
          selectedColorText.textContent = selectedColor;
          selectedSize = "";
          selectedSizeText.textContent = "Chọn size";
          updateSizeOptions();
          updateSelectedVariant();
        });
      });

      sizeButtons.forEach(button => {
        button.addEventListener("click", () => {
          if (button.hidden) return;
          sizeButtons.forEach(sizeButton => {
            const selected = sizeButton === button;
            sizeButton.classList.toggle("active", selected);
            sizeButton.setAttribute("aria-pressed", String(selected));
          });
          selectedSize = button.dataset.size;
          selectedSizeText.textContent = selectedSize;
          updateSelectedVariant();
        });
      });

      form.addEventListener("submit", event => {
        const variant = variants.find(item =>
          String(item.id) === variantIdInput.value &&
          item.color === selectedColor &&
          item.size === selectedSize
        );

        if (!variant || Number(variant.stock) <= 0) {
          event.preventDefault();
          stockNotice.textContent = !selectedColor || !selectedSize
            ? "Vui lòng chọn màu sắc và kích cỡ."
            : "Phân loại này hiện đã hết hàng.";
          stockNotice.classList.remove("is-available");
          return;
        }

        const quantity = Number(quantityInput.value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(variant.stock)) {
          event.preventDefault();
          quantityInput.value = String(Math.max(1, Math.min(Number.isInteger(quantity) ? quantity : 1, Number(variant.stock), 99)));
        }
      });
    } else {
      const available = productStock > 0;
      addButton.disabled = !available;
      resetQuantity(productStock, !available);
      if (form) {
        form.addEventListener("submit", event => {
          const quantity = Number(quantityInput.value);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > productStock) {
            event.preventDefault();
            quantityInput.value = String(Math.max(1, Math.min(Number.isInteger(quantity) ? quantity : 1, productStock, 99)));
          }
        });
      }
    }
  }

  const mainImage = document.getElementById("pd-main-image");
  const imageError = document.getElementById("pd-image-error");
  const thumbnails = [...document.querySelectorAll(".pd-thumbnail")];

  if (mainImage && imageError) {
    function showImageError() {
      mainImage.hidden = true;
      imageError.hidden = false;
    }

    function showImage() {
      mainImage.hidden = false;
      imageError.hidden = true;
    }

    mainImage.addEventListener("error", showImageError);
    mainImage.addEventListener("load", showImage);

    // Xử lý cả trường hợp ảnh đã tải xong trước khi JS chạy.
    if (mainImage.complete) {
      if (mainImage.naturalWidth > 0) {
        showImage();
      } else {
        showImageError();
      }
    }

    thumbnails.forEach((button) => {
      button.addEventListener("click", () => {
        const imageUrl = button.dataset.image;
        if (!imageUrl) return;

        thumbnails.forEach((item) => {
          const selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });

        showImage();
        mainImage.src = imageUrl;
      });
    });
  }

  const tabs = [...document.querySelectorAll(".pd-tab")];

  function activateTab(selectedTab) {
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      const panel = document.getElementById(
        tab.getAttribute("aria-controls")
      );

      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;

      if (panel) panel.hidden = !selected;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));

    tab.addEventListener("keydown", (event) => {
      let nextIndex;

      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      activateTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
})();