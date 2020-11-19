import { convertToArray, debounce } from "./utils.js";

function parseParams(str) {
  const pieces = str.split("&");
  const data = {};
  let i;
  let parts;
  // process each query pair
  for (i = 0; i < pieces.length; i++) {
    parts = pieces[i].split("=");
    if (parts.length < 2) {
      parts.push("");
    }
    data[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }
  return data;
}

function getUID() {
  return Math.random().toString(36).substr(2, 9);
}

let mousePosition = { x: 0, y: 0 };

function trackMouse(event) {
  mousePosition = {
    x: event.clientX,
    y: event.clientY,
  };

  console.log("mousePosition", mousePosition);
}

function getHightlight() {
  const pageIndex = window.PDFViewerApplication.pdfViewer.currentPageNumber - 1;
  const page = window.PDFViewerApplication.pdfViewer.getPageView(pageIndex);
  const pageRect = page.canvas.getClientRects()[0];
  const selectionRects = window.getSelection().getRangeAt(0).getClientRects();
  const selectionRectsArray = convertToArray(selectionRects);
  const viewport = page.viewport;
  const coords = selectionRectsArray.map(r => {
    return viewport
      .convertToPdfPoint(r.left - pageRect.x, r.top - pageRect.y)
      .concat(
        viewport.convertToPdfPoint(r.right - pageRect.x, r.bottom - pageRect.y)
      );
  });

  return {
    id: getUID(),
    coords,
    page: pageIndex,
    text: document.getSelection().toString(),
    fingerprint: window.PDFViewerApplication.pdfDocument.fingerprint,
  };
}

function renderHighlight(highlight) {
  const pageIndex = highlight.page;
  const page = window.PDFViewerApplication.pdfViewer.getPageView(pageIndex);
  const pageElement = page.canvas.parentElement;
  const viewport = page.viewport;

  highlight.coords.forEach(rect => {
    const bounds = viewport.convertToViewportRectangle(rect);
    const el = document.createElement("div");

    const [r, g, b] = [1, 2, 3].map(() => Math.floor(Math.random() * 255));

    el.setAttribute(
      "style",
      `
        position: absolute;
        background-color: rgba(${r}, ${g}, ${b}, .4);
        left: ${Math.min(bounds[0], bounds[2])}px; 
        top: ${Math.min(bounds[1], bounds[3])}px; 
        width: ${Math.abs(bounds[0] - bounds[2])}px; 
        height: ${Math.abs(bounds[1] - bounds[3])}px;
      `
    );

    pageElement.appendChild(el);
  });
}

function saveHighlight(highlight) {
  try {
    const highlights = JSON.parse(localStorage.getItem("lara"));
    const newHighlights = [...(highlights || []), highlight];
    localStorage.setItem("lara", JSON.stringify(newHighlights));
  } catch (error) {
    // TODO
  }
}

function isSelectionHiglhight() {
  return !!document.getSelection().toString();
}

let alreadyRun = false;

function renderSavedHighlights() {
  if (alreadyRun) {
    return;
  }

  alreadyRun = true;

  console.log("renderSavedHighlights");
  const highlights = JSON.parse(localStorage.getItem("lara"));

  console.log("highlights", highlights);

  (highlights || []).forEach(renderHighlight);
}

function renderHighlightInDevTools(highlight) {
  const ul = document.querySelector("#dev-tools > ul");
  const li = document.createElement("li");
  const anchor = document.createElement("a");

  anchor.setAttribute(
    "href",
    `${window.location.pathname}#highlight=${highlight.id}`
  );

  anchor.appendChild(document.createTextNode(highlight.text));
  li.appendChild(anchor);
  ul.appendChild(li);
}

function createHighlight() {
  if (!isSelectionHiglhight() || started) {
    return;
  }

  const highlight = getHightlight();

  console.log(document.getSelection().toString());
  console.log(document.getSelection());

  // TODO confirm highlight
  // TODO check if highlight already exists?

  saveHighlight(highlight);
  renderHighlight(highlight);
  renderHighlightInDevTools(highlight);
}

export const getDocument = elm => (elm || {}).ownerDocument || document;

export const getWindow = elm => (getDocument(elm) || {}).defaultView || window;

const isHTMLCanvasElement = elm =>
  elm instanceof HTMLCanvasElement ||
  elm instanceof getWindow(elm).HTMLCanvasElement;

function getAreaAsPNG(canvas, position) {
  const { left, top, width, height } = position;

  const doc = canvas ? canvas.ownerDocument : null;
  const newCanvas = doc && doc.createElement("canvas");

  if (!newCanvas || !isHTMLCanvasElement(newCanvas)) {
    return "";
  }

  newCanvas.width = width;
  newCanvas.height = height;

  const newCanvasContext = newCanvas.getContext("2d");

  if (!newCanvasContext || !canvas) {
    return "";
  }

  const dpr = window.devicePixelRatio;

  newCanvasContext.drawImage(
    canvas,
    left * dpr,
    top * dpr,
    width * dpr,
    height * dpr,
    0,
    0,
    width,
    height
  );

  return newCanvas.toDataURL("image/png");
}

let started = false;

function areaHiglhightStuff() {
  let areaSelection = {};

  document.addEventListener("mousedown", event => {
    started = !!event.altKey;

    areaSelection = {
      x: event.clientX,
      y: event.clientY,
    };
  });

  document.addEventListener("mouseup", event => {
    if (started) {
      const pageIndex =
        window.PDFViewerApplication.pdfViewer.currentPageNumber - 1;
      const page = window.PDFViewerApplication.pdfViewer.getPageView(pageIndex);
      const pageElement = page.canvas.parentElement;
      const pageRect = page.canvas.getClientRects()[0];
      const viewport = page.viewport;

      const x1 = areaSelection.x;
      const y1 = areaSelection.y;
      const x2 = event.clientX;
      const y2 = event.clientY;

      areaSelection = {
        ...areaSelection,
        w: Math.abs(areaSelection.x - event.clientX),
        h: Math.abs(areaSelection.y - event.clientY),
        x2,
        y2,
      };

      console.log("areaSelection", areaSelection);

      const selectionRect = {
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        right: Math.max(x1, x2),
        bottom: Math.max(y1, y2),
      };

      console.log("selectionRect", selectionRect);

      const rect = viewport
        .convertToPdfPoint(
          selectionRect.left - pageRect.x,
          selectionRect.top - pageRect.y
        )
        .concat(
          viewport.convertToPdfPoint(
            selectionRect.right - pageRect.x,
            selectionRect.bottom - pageRect.y
          )
        );

      const bounds = viewport.convertToViewportRectangle(rect);

      console.log("bounds", bounds);

      const div = document.createElement("div");

      div.setAttribute(
        "style",
        `
          position: absolute;
          background-color: red;
          opacity: 0.5;
          left: ${Math.min(bounds[0], bounds[2])}px; 
          top: ${Math.min(bounds[1], bounds[3])}px; 
          width: ${Math.abs(bounds[0] - bounds[2])}px; 
          height: ${Math.abs(bounds[1] - bounds[3])}px;
        `
      );

      // div.setAttribute(
      //   "style",
      //   `
      //     position: absolute;
      //     top: ${areaSelection.y}px;
      //     left: ${areaSelection.x}px;
      //     width: ${areaSelection.w}px;
      //     height: ${areaSelection.h}px;
      //     background-color: red;
      //     opacity: 0.5;
      //   `
      // );

      // document.querySelector("body").appendChild(div);
      pageElement.appendChild(div);

      const position = {
        left: Math.min(bounds[0], bounds[2]),
        top: Math.min(bounds[1], bounds[3]),
        width: Math.abs(bounds[0] - bounds[2]),
        height: Math.abs(bounds[1] - bounds[3]),
      };

      const screenshot = getAreaAsPNG(page.canvas, position);
      console.log("screenshot", screenshot);
      window.screenshot = screenshot;

      started = false;
    }
  });

  document.addEventListener("mousemove", event => {
    if (started && !!event.altKey) {
      console.log("area selecting");
    }
  });
}

function renderDevTools() {
  window.addEventListener("hashchange", () => {
    console.log("location changed!");

    // TODO use page + highlight query var in hash url

    const id = window.location.hash.replace("#highlight=", "");
    const highlights = JSON.parse(localStorage.getItem("lara"));

    const highlight = highlights.find(item => item.id === id);

    console.log("found highlight", highlight);

    window.PDFViewerApplication.page = highlight.page + 1;
  });

  const panel = document.createElement("div");
  const ul = document.createElement("ul");

  ul.setAttribute(
    "style",
    `
      padding: 20px;
      font-size: 11px;
    `
  );

  panel.setAttribute("id", "dev-tools");
  panel.setAttribute(
    "style",
    `
      position: absolute;
      background-color: #e8e8e8;
      right: 0px; 
      bottom: 0px; 
      width: 240px; 
      height: 200px;
      margin: 12px;
      border: 1px solid #9e9e9e;
      border-radius: 2px;
      box-shadow: 0px 1px 4px #0000004a;
    `
  );

  panel.appendChild(ul);

  document.querySelector("body").appendChild(panel);
}

async function uploadPdf() {
  console.log("uploadPdf");

  try {
    const data_uintarray = await window.PDFViewerApplication.pdfDocument.getData();
    console.log("data_uintarray", data_uintarray);

    const data_blob = new Blob([data_uintarray]);
    console.log("data_blob", data_blob);

    const body = new FormData();
    const { fingerprint } = window.PDFViewerApplication.pdfDocument;

    body.append("file", `${fingerprint}.pdf`);
    body.append("data", data_blob);

    await fetch("http://localhost:5000/upload", { method: "POST", body });
  } catch (e) {
    console.log("upload error", e);
    //
  }
}

export function start_lara_app() {
  const debouncedTrackMouse = debounce(trackMouse, 250);
  const debouncedCreateHighlight = debounce(createHighlight, 250);

  window.PDFViewerApplication.initializedPromise.then(() => {
    document.addEventListener("mousemove", debouncedTrackMouse);
    document.addEventListener("selectionchange", debouncedCreateHighlight);

    window.PDFViewerApplication.eventBus.on("documentloaded", () => {
      console.log("eventbus: documentload");
      uploadPdf();
    });

    window.PDFViewerApplication.eventBus.on("pagerendered", () => {
      console.log("eventbus: pagerendered");
      renderSavedHighlights();
    });

    areaHiglhightStuff();

    renderDevTools();
  });
}

window.renderSavedHighlights = renderSavedHighlights;
