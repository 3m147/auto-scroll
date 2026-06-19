(function () {
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const fileInput = document.querySelector("#fileInput");
  const playButton = document.querySelector("#playButton");
  const fullscreenButton = document.querySelector("#fullscreenButton");
  const speedInput = document.querySelector("#speedInput");
  const speedOutput = document.querySelector("#speedOutput");
  const viewer = document.querySelector("#viewer");
  const content = document.querySelector("#content");
  const dropZone = document.querySelector("#dropZone");
  const directionButtons = Array.from(document.querySelectorAll("[data-direction]"));

  const state = {
    direction: "down",
    isPlaying: false,
    lastFrameTime: 0,
    objectUrl: null,
    pdfRenderToken: 0,
    fullscreenClickTimer: null,
  };

  function setMessage(title, detail) {
    content.innerHTML = "";
    showDropZone();
    dropZone.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  }

  function showDropZone() {
    viewer.classList.remove("has-file");
    dropZone.hidden = false;
    dropZone.removeAttribute("aria-hidden");
    dropZone.style.display = "";
    dropZone.style.pointerEvents = "";
  }

  function hideDropZone() {
    viewer.classList.add("has-file");
    dropZone.hidden = true;
    dropZone.setAttribute("aria-hidden", "true");
    dropZone.style.display = "none";
    dropZone.style.pointerEvents = "none";
  }

  function clearObjectUrl() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
  }

  function resetViewer() {
    pause();
    clearObjectUrl();
    state.pdfRenderToken += 1;
    viewer.scrollTop = 0;
    content.innerHTML = "";
    hideDropZone();
  }

  function setDirection(direction) {
    state.direction = direction;
    directionButtons.forEach((button) => {
      const isSelected = button.dataset.direction === direction;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  function getSpeed() {
    return Number(speedInput.value);
  }

  function updateSpeedLabel() {
    speedOutput.value = Number(speedInput.value).toFixed(1);
  }

  function tick(timestamp) {
    if (!state.isPlaying) {
      return;
    }

    if (!state.lastFrameTime) {
      state.lastFrameTime = timestamp;
    }

    const elapsed = timestamp - state.lastFrameTime;
    state.lastFrameTime = timestamp;

    const pixelsPerSecond = getSpeed() * 36;
    const movement = (pixelsPerSecond * elapsed) / 1000;
    viewer.scrollTop += state.direction === "down" ? movement : -movement;

    const atTop = viewer.scrollTop <= 0;
    const atBottom = viewer.scrollTop + viewer.clientHeight >= viewer.scrollHeight - 1;
    if ((state.direction === "up" && atTop) || (state.direction === "down" && atBottom)) {
      pause();
      return;
    }

    requestAnimationFrame(tick);
  }

  function play() {
    if (!content.children.length || getSpeed() === 0) {
      return;
    }

    state.isPlaying = true;
    state.lastFrameTime = 0;
    playButton.textContent = "정지";
    playButton.setAttribute("aria-pressed", "true");
    requestAnimationFrame(tick);
  }

  function pause() {
    state.isPlaying = false;
    state.lastFrameTime = 0;
    playButton.textContent = "시작";
    playButton.setAttribute("aria-pressed", "false");
  }

  function loadPdfJs() {
    if (window.pdfjsLib) {
      return Promise.resolve(window.pdfjsLib);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_URL;
      script.async = true;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function renderPdf(file) {
    resetViewer();
    content.innerHTML = '<div class="loading">PDF 불러오는 중...</div>';
    const renderToken = state.pdfRenderToken;

    try {
      const pdfjsLib = await loadPdfJs();
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      content.innerHTML = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (renderToken !== state.pdfRenderToken) {
          return;
        }

        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, viewer.clientWidth - 48);
        const scale = Math.min(2, availableWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.className = "pdf-page";
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        content.appendChild(canvas);
        await page.render({ canvasContext: context, viewport }).promise;
      }
    } catch (error) {
      showPdfFallback(file);
    }
  }

  function showPdfFallback(file) {
    clearObjectUrl();
    state.objectUrl = URL.createObjectURL(file);
    content.innerHTML = "";

    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent =
      "PDF.js를 불러오지 못해 내장 PDF 보기로 열었습니다. 자동 스크롤은 브라우저에 따라 제한될 수 있습니다.";

    const frame = document.createElement("iframe");
    frame.className = "pdf-fallback";
    frame.title = file.name;
    frame.src = state.objectUrl;

    content.append(notice, frame);
  }

  function renderImage(file) {
    resetViewer();
    state.objectUrl = URL.createObjectURL(file);

    const image = document.createElement("img");
    image.alt = file.name || "선택한 이미지";
    image.src = state.objectUrl;
    content.appendChild(image);
  }

  function handleFile(file) {
    if (!file) {
      return;
    }

    if (file.type.startsWith("image/")) {
      renderImage(file);
      return;
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      renderPdf(file);
      return;
    }

    resetViewer();
    setMessage("지원하지 않는 파일입니다", "이미지 파일 또는 PDF 파일을 선택하세요.");
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      fullscreenButton.textContent = "화면복귀";
      return;
    }

    await document.exitFullscreen();
    fullscreenButton.textContent = "전체화면";
  }

  function togglePlay() {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function handleViewerClick(event) {
    if (!document.fullscreenElement) {
      return;
    }

    if (state.fullscreenClickTimer) {
      clearTimeout(state.fullscreenClickTimer);
      state.fullscreenClickTimer = null;
      handleViewerDoubleClick();
      return;
    }

    state.fullscreenClickTimer = setTimeout(() => {
      state.fullscreenClickTimer = null;
      togglePlay();
    }, 240);
  }

  function handleViewerDoubleClick() {
    if (!document.fullscreenElement) {
      return;
    }

    if (state.fullscreenClickTimer) {
      clearTimeout(state.fullscreenClickTimer);
      state.fullscreenClickTimer = null;
    }

    document.exitFullscreen().catch(() => {});
  }

  fileInput.addEventListener("change", (event) => {
    handleFile(event.target.files[0]);
    event.target.value = "";
  });

  playButton.addEventListener("click", togglePlay);

  fullscreenButton.addEventListener("click", () => {
    toggleFullscreen().catch(() => {
      fullscreenButton.textContent = "전체화면";
    });
  });

  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement ? "화면복귀" : "전체화면";
  });

  speedInput.addEventListener("input", () => {
    updateSpeedLabel();
    if (getSpeed() === 0) {
      pause();
    }
  });

  directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setDirection(button.dataset.direction);
    });
  });

  viewer.addEventListener("dragover", (event) => {
    event.preventDefault();
    viewer.classList.add("dragging");
  });

  viewer.addEventListener("dragleave", () => {
    viewer.classList.remove("dragging");
  });

  viewer.addEventListener("drop", (event) => {
    event.preventDefault();
    viewer.classList.remove("dragging");
    handleFile(event.dataTransfer.files[0]);
  });

  viewer.addEventListener("click", handleViewerClick);
  viewer.addEventListener("dblclick", handleViewerDoubleClick);

  function handleDropZoneClick() {
    if (dropZone.hidden || viewer.classList.contains("has-file")) {
      return;
    }

    fileInput.click();
  }

  dropZone.addEventListener("click", handleDropZoneClick);

  updateSpeedLabel();
  setDirection("down");
})();
