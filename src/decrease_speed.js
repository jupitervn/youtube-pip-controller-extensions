(() => {
    const pipEle = document.pictureInPictureElement;
    if (pipEle && pipEle.playbackRate > 0) {
        pipEle.playbackRate -= 0.5;
    }
})();
