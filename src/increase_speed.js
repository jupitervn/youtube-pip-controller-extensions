(() => {
    const pipEle = document.pictureInPictureElement;
    if (pipEle) {
        pipEle.playbackRate += 0.25;
        return;
    }
    const playingVideos = Array.from(document.querySelectorAll('video'))
        .filter(video => video.readyState != 0);
    if (playingVideos.length > 0) {
        playingVideos[0].playbackRate += 0.25;
        return;
    }
})();