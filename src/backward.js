(async () => {
    const pipEle = document.pictureInPictureElement;
    if (pipEle) {
        pipEle.currentTime -= 10;
        return true;
    }
    return false;
})();