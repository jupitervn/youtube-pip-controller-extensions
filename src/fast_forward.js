(async () => {
    const pipEle = document.pictureInPictureElement;
    if (pipEle) {
        pipEle.currentTime += 10;
        return true;
    }
    const playingVideos = Array.from(document.querySelectorAll('video'))
        .filter(video => video.readyState != 0);
    if (playingVideos.length > 0) {
        playingVideos[0].currentTime += 10;
        return true;
    }
    return false;
})();