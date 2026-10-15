(() => {
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