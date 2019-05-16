function getVisibleFrame(iframe) {
    const rect = iframe.getBoundingClientRect();
    var visibleHeight = Math.max(Math.min(window.innerHeight - rect.top, rect.height), 0);
    if (rect.top < 0) {
        visibleHeight = Math.max(rect.bottom, 0);
    }
    var visibleWidth = Math.min(window.innerWidth - rect.left, rect.width);
    if (rect.left < 0) {
        visibleWidth = Math.max(rect.right, 0);
    }
    return visibleHeight * visibleWidth;
}

(() => {
    var iframesVisibleRect = {};
    const iframes = document.querySelectorAll("iframe");
    for (iframe of iframes) {
        if (iframe.src.includes("youtube.com")) {
            var duplicatedArea = iframesVisibleRect[iframe.src];
            if (duplicatedArea == null) {
                duplicatedArea = 0;
            }
            const frameArea = getVisibleFrame(iframe);
            iframesVisibleRect[iframe.src] = Math.max(frameArea, duplicatedArea);
        }
    }
    return iframesVisibleRect;
})();


