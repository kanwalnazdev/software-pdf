const pdfInput = document.getElementById("pdfInput");
const pdfPreview = document.getElementById("pdfPreview");
const convertBtn = document.getElementById("convertBtn");
const pdfMessage = document.getElementById("pdfMessage");

const linkInput = document.getElementById("linkInput");
const linkPreview = document.getElementById("linkPreview");
const uploadBtn = document.getElementById("uploadBtn");
const linkResult = document.getElementById("linkResult");
const linkMessage = document.getElementById("linkMessage");
const maxFileSize = 10 * 1024 * 1024;
const maxImages = 20;
let pdfFiles = [];
let linkFiles = [];
let pdfPreviewUrls = [];
let linkPreviewUrls = [];
let generatedUrls = [];

function clearUrls(urls) {
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.length = 0;
}

function validateFiles(files) {
    if (files.length > maxImages) {
        return "Please select no more than " + maxImages + " images.";
    }

    if (files.some(file => !file.type.startsWith("image/"))) {
        return "Please select image files only.";
    }

    if (files.some(file => file.size > maxFileSize)) {
        return "Each image must be smaller than 10 MB.";
    }

    return "";
}

function renderPreviews(files, container, urls, onRemove) {
    clearUrls(urls);
    container.replaceChildren();

    files.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "preview-item";

        const img = document.createElement("img");
        const url = URL.createObjectURL(file);
        img.src = url;
        img.alt = file.name;
        urls.push(url);

        const removeButton = document.createElement("button");
        removeButton.className = "remove-image";
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", "Remove " + file.name);
        removeButton.addEventListener("click", () => onRemove(index));

        item.append(img, removeButton);
        container.appendChild(item);
    });
}

function renderPdfPreviews() {
    renderPreviews(pdfFiles, pdfPreview, pdfPreviewUrls, index => {
        pdfFiles.splice(index, 1);
        renderPdfPreviews();
        pdfMessage.textContent = pdfFiles.length
            ? pdfFiles.length + " image(s) selected."
            : "No images selected.";
    });
}

function renderLinkPreviews() {
    renderPreviews(linkFiles, linkPreview, linkPreviewUrls, index => {
        linkFiles.splice(index, 1);
        clearUrls(generatedUrls);
        linkResult.replaceChildren();
        linkResult.hidden = true;
        renderLinkPreviews();
        linkMessage.textContent = linkFiles.length
            ? linkFiles.length + " image(s) selected."
            : "No images selected.";
    });
}

function makeCopyButton(url) {
    const button = document.createElement("button");
    button.className = "copy-button";
    button.type = "button";
    button.textContent = "Copy Link";

    button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(url);
            button.textContent = "Copied!";
        } catch (error) {
            const temporaryInput = document.createElement("textarea");
            temporaryInput.value = url;
            temporaryInput.style.position = "fixed";
            temporaryInput.style.opacity = "0";
            document.body.appendChild(temporaryInput);
            temporaryInput.select();
            const copied = document.execCommand("copy");
            temporaryInput.remove();

            if (!copied) {
                linkMessage.textContent = "Could not copy the link.";
                return;
            }
            button.textContent = "Copied!";
        }
    });

    return button;
}

pdfInput.addEventListener("change", function () {
    pdfFiles = Array.from(this.files);
    this.value = "";
    pdfMessage.textContent = "";

    const error = validateFiles(pdfFiles);
    if (error) {
        pdfFiles = [];
        renderPdfPreviews();
        pdfMessage.textContent = error;
        return;
    }

    renderPdfPreviews();

    if (pdfFiles.length) {
        pdfMessage.textContent = pdfFiles.length + " image(s) selected.";
    }
});

convertBtn.addEventListener("click", async function () {
    if (!pdfFiles.length) {
        pdfMessage.textContent = "Please select images first.";
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        pdfMessage.textContent = "PDF library did not load. Check your internet connection and reload.";
        return;
    }

    convertBtn.disabled = true;
    pdfMessage.textContent = "Creating your PDF...";

    try {
        const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;

        for (let index = 0; index < pdfFiles.length; index++) {
            const imageUrl = URL.createObjectURL(pdfFiles[index]);
            try {
                const image = await new Promise((resolve, reject) => {
                    const element = new Image();
                    element.onload = () => resolve(element);
                    element.onerror = reject;
                    element.src = imageUrl;
                });

                if (index > 0) pdf.addPage();

                const scale = Math.min(
                    (pageWidth - margin * 2) / image.width,
                    (pageHeight - margin * 2) / image.height
                );
                const width = image.width * scale;
                const height = image.height * scale;
                const canvas = document.createElement("canvas");
                const resize = Math.min(1, 2000 / Math.max(image.width, image.height));
                canvas.width = Math.max(1, Math.round(image.width * resize));
                canvas.height = Math.max(1, Math.round(image.height * resize));
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Could not prepare image for PDF.");
                context.fillStyle = "#fff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);

                pdf.addImage(
                    canvas.toDataURL("image/jpeg", 0.92),
                    "JPEG",
                    10,
                    (pageWidth - width) / 2,
                    (pageHeight - height) / 2,
                    width,
                    height
                );
            } finally {
                URL.revokeObjectURL(imageUrl);
            }
        }

        pdf.save("My-Images.pdf");
        pdfMessage.textContent = "Your PDF has been downloaded.";
    } catch (error) {
        console.error(error);
        pdfMessage.textContent = "Could not create the PDF. Please try another image.";
    } finally {
        convertBtn.disabled = false;
    }
});

linkInput.addEventListener("change", function () {
    clearUrls(generatedUrls);
    linkFiles = Array.from(this.files);
    this.value = "";
    linkResult.replaceChildren();
    linkResult.hidden = true;
    linkMessage.textContent = "";

    const error = validateFiles(linkFiles);
    if (error) {
        linkFiles = [];
        renderLinkPreviews();
        linkMessage.textContent = error;
        return;
    }

    renderLinkPreviews();
    if (linkFiles.length) {
        linkMessage.textContent = linkFiles.length + " image(s) selected.";
    }
});

uploadBtn.addEventListener("click", function () {
    if (!linkFiles.length) {
        linkMessage.textContent = "Please select images first.";
        return;
    }

    clearUrls(generatedUrls);
    linkResult.replaceChildren();

    linkFiles.forEach(file => {
        const url = URL.createObjectURL(file);
        generatedUrls.push(url);

        const row = document.createElement("div");
        row.className = "link-row";

        const input = document.createElement("input");
        input.type = "text";
        input.readOnly = true;
        input.value = url;
        input.setAttribute("aria-label", "Temporary link for " + file.name);

        const copyButton = makeCopyButton(url);
        const downloadButton = document.createElement("a");
        downloadButton.className = "download-button";
        downloadButton.href = url;
        downloadButton.download = file.name;
        downloadButton.textContent = "Download";

        row.append(input, copyButton, downloadButton);
        linkResult.appendChild(row);
    });

    linkResult.hidden = false;
    linkMessage.textContent = "Temporary links created. They work only in this browser session.";
});
